import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { compensationRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: compensationRecords.orgId })
        .from(compensationRecords)
        .where(eq(compensationRecords.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "compensation", "update");

      const [updated] = await db
        .update(compensationRecords)
        .set({
          baseSalary: body.base_salary ?? undefined,
          currency: body.currency ?? undefined,
          effectiveDate: body.effective_date ?? undefined,
          bonus: body.bonus === undefined ? undefined : body.bonus,
          benefits: body.benefits === undefined ? undefined : body.benefits,
        })
        .where(eq(compensationRecords.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Compensation record not found");

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
      const [existing] = await db
        .select({ orgId: compensationRecords.orgId })
        .from(compensationRecords)
        .where(eq(compensationRecords.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "compensation", "delete");

      const [deleted] = await db.delete(compensationRecords).where(eq(compensationRecords.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Compensation record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
