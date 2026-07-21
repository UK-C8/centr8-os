// Planner agent (FR-7.x), Tier 0 — Suggest Only. This only ever calls out
// to Gemini and returns a draft; it must never write to the DB itself. The
// human-in-the-loop write path lives entirely in the accept route.
import { ApiError } from "@/lib/api/helpers";
import type { ProjectDraft } from "./projectDraft";

const DRAFT_INSTRUCTIONS = `You are the Planner agent for Centr8 OS, an AI project manager. Given a free-text request, produce a structured project-creation draft as strict JSON matching exactly this shape (no extra keys, no markdown fences, no commentary):

{
  "goal": { "title": string, "description": string | null },
  "project": {
    "name": string,
    "description": string | null,
    "status": "planning" | "active" | "on_hold" | "completed" | "archived",
    "start_date": string | null,
    "end_date": string | null
  },
  "milestones": [ { "name": string, "due_date": string | null } ],
  "sprints": [ { "name": string, "start_date": string | null, "end_date": string | null, "status": "planned" | "active" | "completed" } ],
  "tasks": [
    {
      "title": string,
      "description": string | null,
      "priority": "low" | "medium" | "high" | "urgent",
      "estimate": number | null,
      "sprint_index": number | null
    }
  ]
}

Dates are "YYYY-MM-DD" or null. "sprint_index" is the index of the task's sprint within the "sprints" array above, or null if unassigned. Default "project.status" to "planning" and every sprint's "status" to "planned" unless the request implies otherwise. Keep it realistic and scoped to what was actually asked — a handful of milestones, a few sprints, a modest task list is typical, not a hard rule.`;

// Shared request path for every Gemini call in the app — draft generation
// and health summaries alike. `json: true` asks Gemini for strict JSON
// output (still returned as text; the caller parses it); omit it for a
// plain-language response.
async function callGemini(promptText: string, opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(502, `Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new ApiError(502, "Gemini returned no content");
  }
  return text;
}

export async function generateProjectDraft(prompt: string): Promise<ProjectDraft> {
  const text = await callGemini(`${DRAFT_INSTRUCTIONS}\n\nRequest: ${prompt}`, { json: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(502, "Gemini returned malformed JSON");
  }

  return normalizeDraft(parsed);
}

const HEALTH_SUMMARY_INSTRUCTIONS = `You are the Monitor agent for Centr8 OS, an AI project manager. Given a project's name and computed health signals (task counts, overdue count, blocked count, per-sprint burn rates), write a plain-language health summary: 2-4 sentences, no markdown, no headings. State the overall picture, then call out anything worth a human's attention (overdue or blocked tasks, a stalled sprint). If the signals look healthy, say so plainly — don't invent risk that isn't in the data. This is informational only; do not suggest or imply any automatic action.`;

export async function generateHealthSummary(projectName: string, signals: unknown): Promise<string> {
  const text = await callGemini(
    `${HEALTH_SUMMARY_INSTRUCTIONS}\n\nProject: ${projectName}\nSignals: ${JSON.stringify(signals)}`,
  );
  return text.trim();
}

// Coerces/validates the LLM's JSON into ProjectDraft — never trust a
// free-text model's output shape enough to hand it straight to db.insert.
function normalizeDraft(value: unknown): ProjectDraft {
  if (typeof value !== "object" || value === null) {
    throw new ApiError(502, "Gemini draft was not a JSON object");
  }
  const v = value as Record<string, unknown>;
  const goal = asRecord(v.goal);
  const project = asRecord(v.project);

  if (typeof goal.title !== "string" || typeof project.name !== "string") {
    throw new ApiError(502, "Gemini draft is missing goal.title or project.name");
  }

  const sprints = asArray(v.sprints).map((s) => {
    const sr = asRecord(s);
    return {
      name: typeof sr.name === "string" ? sr.name : "Untitled sprint",
      start_date: asStringOrNull(sr.start_date),
      end_date: asStringOrNull(sr.end_date),
      status: asEnum(sr.status, ["planned", "active", "completed"] as const, "planned"),
    };
  });

  return {
    goal: { title: goal.title, description: asStringOrNull(goal.description) },
    project: {
      name: project.name,
      description: asStringOrNull(project.description),
      status: asEnum(
        project.status,
        ["planning", "active", "on_hold", "completed", "archived"] as const,
        "planning",
      ),
      start_date: asStringOrNull(project.start_date),
      end_date: asStringOrNull(project.end_date),
    },
    milestones: asArray(v.milestones).map((m) => {
      const mr = asRecord(m);
      return {
        name: typeof mr.name === "string" ? mr.name : "Untitled milestone",
        due_date: asStringOrNull(mr.due_date),
      };
    }),
    sprints,
    tasks: asArray(v.tasks).map((t) => {
      const tr = asRecord(t);
      const sprintIndex = typeof tr.sprint_index === "number" ? tr.sprint_index : null;
      return {
        title: typeof tr.title === "string" ? tr.title : "Untitled task",
        description: asStringOrNull(tr.description),
        priority: asEnum(tr.priority, ["low", "medium", "high", "urgent"] as const, "medium"),
        estimate: typeof tr.estimate === "number" ? tr.estimate : null,
        sprint_index: sprintIndex !== null && sprintIndex >= 0 && sprintIndex < sprints.length ? sprintIndex : null,
      };
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
}
