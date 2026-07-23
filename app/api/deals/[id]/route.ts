import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(deals).where(eq(deals.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "deal", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Deal not found");

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
      const [existing] = await db.select({ orgId: deals.orgId }).from(deals).where(eq(deals.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "deal", "update");

      const [updated] = await db
        .update(deals)
        .set({
          accountId: body.account_id ?? undefined,
          contactId: body.contact_id === undefined ? undefined : body.contact_id,
          name: body.name ?? undefined,
          value: body.value === undefined ? undefined : body.value,
          currency: body.currency ?? undefined,
          stage: body.stage ?? undefined,
          ownerId: body.owner_id === undefined ? undefined : body.owner_id,
          expectedCloseDate: body.expected_close_date === undefined ? undefined : body.expected_close_date,
        })
        .where(eq(deals.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Deal not found");

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
      const [existing] = await db.select({ orgId: deals.orgId }).from(deals).where(eq(deals.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "deal", "delete");
      const [deleted] = await db.delete(deals).where(eq(deals.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Deal not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
