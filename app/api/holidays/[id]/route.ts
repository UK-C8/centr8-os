import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { holidays } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: holidays.orgId }).from(holidays).where(eq(holidays.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "holiday", "update");

      const [updated] = await db
        .update(holidays)
        .set({
          date: body.date ?? undefined,
          name: body.name ?? undefined,
        })
        .where(eq(holidays.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Holiday not found");

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
      const [existing] = await db.select({ orgId: holidays.orgId }).from(holidays).where(eq(holidays.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "holiday", "delete");
      const [deleted] = await db.delete(holidays).where(eq(holidays.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Holiday not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
