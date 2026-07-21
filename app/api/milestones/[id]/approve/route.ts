import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { milestones } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { approveMilestone } from "@/lib/api/milestoneApproval";

type Params = { params: Promise<{ id: string }> };

// Internal (org-member) approval path — RBAC-gated via can("milestone",
// "approve"). The client-facing equivalent is app/api/portal/[org_slug]/
// milestones/[id]/approve, token-gated instead; both call the same
// lib/api/milestoneApproval.ts helper so the audit_log entry matches.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: milestones.orgId }).from(milestones).where(eq(milestones.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "milestone", "approve");

      return approveMilestone(db, id, existing.orgId, { type: "human", userId });
    });
    if (!row) throw new ApiError(404, "Milestone not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
