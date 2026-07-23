import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "lead", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Lead not found");

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
    // "converted" is only ever set by POST /api/leads/[id]/convert, which
    // also creates the account/contact pair — never a bare status edit.
    if (body.status === "converted") throw new ApiError(400, "Use POST /api/leads/[id]/convert to convert a lead");

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "lead", "update");

      const [updated] = await db
        .update(leads)
        .set({
          name: body.name ?? undefined,
          company: body.company === undefined ? undefined : body.company,
          email: body.email === undefined ? undefined : body.email,
          phone: body.phone === undefined ? undefined : body.phone,
          source: body.source === undefined ? undefined : body.source,
          status: body.status ?? undefined,
          ownerId: body.owner_id === undefined ? undefined : body.owner_id,
          campaignId: body.campaign_id === undefined ? undefined : body.campaign_id,
        })
        .where(eq(leads.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Lead not found");

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
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "lead", "delete");
      const [deleted] = await db.delete(leads).where(eq(leads.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Lead not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
