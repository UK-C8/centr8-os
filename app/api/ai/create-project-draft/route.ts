import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { agentJobs } from "@/db/schema";
import { ApiError, handleApiError, pollAgentJob, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import type { CreateProjectDraftInput } from "@/lib/agents/planner";

// Tier 0 — Suggest Only (CLAUDE.md §4). This route must never write to
// goals/projects/milestones/sprints/tasks — only POST .../accept does,
// and only on an explicit human click.
//
// Prompt 2.1: enqueues a Planner job for workers/agent-worker.ts to pick
// up (SELECT ... FOR UPDATE SKIP LOCKED) instead of calling Gemini inline.
// The worker itself writes the audit_log entry (lib/agents/registry.ts's
// "ai_project_draft_generated" auditAction) once the job finishes.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.prompt) {
      throw new ApiError(400, "org_id and prompt are required");
    }

    // Gate on the same permission accepting will need, so a user who can't
    // create a project doesn't get to spend Gemini quota drafting one.
    await withOrgContext(userId, (db) => requirePermission(db, userId, body.org_id, "project", "create"));

    const input: CreateProjectDraftInput = { prompt: body.prompt };
    const [job] = await withOrgContext(userId, (db) =>
      db
        .insert(agentJobs)
        .values({
          orgId: body.org_id,
          agentType: "planner",
          jobType: "create_project_draft",
          tier: "tier_0",
          requestedByUserId: userId,
          input,
        })
        .returning(),
    );

    const finished = await pollAgentJob(userId, job.id);

    return NextResponse.json({ data: { draftId: finished.id, draft: finished.output } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
