import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { engagementSurveys } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: engagementSurveys.orgId }).from(engagementSurveys).where(eq(engagementSurveys.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "engagement", "delete");
      const [deleted] = await db.delete(engagementSurveys).where(eq(engagementSurveys.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Survey not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
