import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateProjectDraft } from "@/lib/ai/gemini";

// Tier 0 — Suggest Only (CLAUDE.md §4). This route must never write to
// goals/projects/milestones/sprints/tasks — only POST .../accept does,
// and only on an explicit human click. The one DB write here is the audit
// log entry recording that a draft was generated, not any project data.
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

    const draft = await generateProjectDraft(body.prompt);

    const [logEntry] = await withOrgContext(userId, (db) =>
      db
        .insert(auditLog)
        .values({
          orgId: body.org_id,
          actorUserId: userId,
          actorType: "ai",
          action: "ai_project_draft_generated",
          targetType: "organization",
          targetId: body.org_id,
          metadata: { prompt: body.prompt, draft },
        })
        .returning(),
    );

    return NextResponse.json({ data: { draftId: logEntry.id, draft } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
