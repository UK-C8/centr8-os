import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { performanceReviews } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "performance", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Performance review not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: performanceReviews.orgId }).from(performanceReviews).where(eq(performanceReviews.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "performance", "update");

      const [updated] = await db
        .update(performanceReviews)
        .set({
          reviewerId: body.reviewer_id === undefined ? undefined : body.reviewer_id,
          period: body.period ?? undefined,
          ratings: body.ratings ?? undefined,
          comments: body.comments === undefined ? undefined : body.comments,
          status: body.status ?? undefined,
        })
        .where(eq(performanceReviews.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Performance review not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: performanceReviews.orgId }).from(performanceReviews).where(eq(performanceReviews.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "performance", "delete");
      const [deleted] = await db.delete(performanceReviews).where(eq(performanceReviews.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Performance review not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
