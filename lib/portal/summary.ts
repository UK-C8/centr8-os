// FR-4.x (Prompt 3.1) task 4 — a plain, computed (non-AI) project status
// summary for the client portal. The Writer/Communicator agents would
// normally generate this kind of client-facing summary (CLAUDE.md §5), but
// they're paused pending the Gemini/Groq provider decision, so this is a
// deliberate, explicitly-scoped stand-in — no AI call, no AiBanner.
//
// TODO(agent-provider): once the Gemini/Groq decision lands and the
// Communicator agent (lib/agents/communicator.ts) has a real job type,
// replace this with a real AI-generated client update summary — same
// spot, same shape, wrapped in the usual AiBanner treatment.
export interface PlainStatusSummary {
  currentMilestoneName: string | null;
  pctTasksDone: number;
}

const CLOSED_TASK_STATUSES = new Set(["done", "cancelled"]);

export function computePlainStatusSummary(
  milestones: { name: string; dueDate: string | null; approvedAt: Date | string | null }[],
  tasks: { status: string }[],
): PlainStatusSummary {
  // "Current milestone" — the soonest-due milestone that isn't approved
  // yet; falls back to the soonest-due milestone overall if every one is
  // already approved (still useful context, not just "nothing to show").
  const byDueDate = [...milestones].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const currentMilestone = byDueDate.find((m) => !m.approvedAt) ?? byDueDate[0] ?? null;

  const countedTasks = tasks.filter((t) => !CLOSED_TASK_STATUSES.has(t.status) || t.status === "done");
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pctTasksDone = countedTasks.length ? Math.round((doneCount / countedTasks.length) * 100) : 0;

  return { currentMilestoneName: currentMilestone?.name ?? null, pctTasksDone };
}
