import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { campaigns } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: campaigns.orgId }).from(campaigns).where(eq(campaigns.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "campaign", "update");

      const [updated] = await db
        .update(campaigns)
        .set({
          name: body.name ?? undefined,
          type: body.type === undefined ? undefined : body.type,
          status: body.status ?? undefined,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
        })
        .where(eq(campaigns.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Campaign not found");

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
      const [existing] = await db.select({ orgId: campaigns.orgId }).from(campaigns).where(eq(campaigns.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "campaign", "delete");
      const [deleted] = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Campaign not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
