import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Symmetric with the generate/accept routes' audit logging (CLAUDE.md's
// acceptance pattern: "an audit log entry written" for every AI action) —
// a rejection is a real reviewer decision worth a permanent record, same
// as an acceptance, and distinct from "Discard" in the UI (which clears
// local state with no server call at all, e.g. the user just wants to
// tweak the prompt and regenerate rather than formally reject the draft).
// Writes nothing but the audit_log row — never touches work-hierarchy
// tables, consistent with every other route in this Tier-0 flow.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id) {
      throw new ApiError(400, "org_id is required");
    }

    const [logEntry] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project", "create");
      return db
        .insert(auditLog)
        .values({
          orgId: body.org_id,
          actorUserId: userId,
          actorType: "human",
          action: "ai_project_draft_rejected",
          targetType: "organization",
          targetId: body.org_id,
          metadata: { draftId: body.draft_id ?? null, reason: body.reason ?? null },
        })
        .returning();
    });

    return NextResponse.json({ data: logEntry }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
