import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireLeaveApproveAccess } from "@/lib/api/employees";

// Approve/reject only (Tier 1-style human approval, per the prompt — no AI
// involved). Status must currently be 'pending' so a decision can't be
// re-applied to an already-decided request.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (body.status !== "approved" && body.status !== "rejected") {
      throw new ApiError(400, "status must be 'approved' or 'rejected'");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return undefined;
      if (existing.status !== "pending") throw new ApiError(409, "This request was already decided");

      await requireLeaveApproveAccess(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(leaveRequests)
        .set({ status: body.status, approvedBy: userId })
        .where(eq(leaveRequests.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Leave request not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
