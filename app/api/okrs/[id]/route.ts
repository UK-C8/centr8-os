import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { okrs } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: okrs.orgId }).from(okrs).where(eq(okrs.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "performance", "update");

      const [updated] = await db
        .update(okrs)
        .set({
          objective: body.objective ?? undefined,
          keyResults: body.key_results ?? undefined,
          period: body.period ?? undefined,
        })
        .where(eq(okrs.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "OKR not found");

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
      const [existing] = await db.select({ orgId: okrs.orgId }).from(okrs).where(eq(okrs.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "performance", "delete");
      const [deleted] = await db.delete(okrs).where(eq(okrs.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "OKR not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
