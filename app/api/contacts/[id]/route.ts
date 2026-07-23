import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { contacts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(contacts).where(eq(contacts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "contact", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Contact not found");

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
      const [existing] = await db.select({ orgId: contacts.orgId }).from(contacts).where(eq(contacts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "contact", "update");

      const [updated] = await db
        .update(contacts)
        .set({
          accountId: body.account_id === undefined ? undefined : body.account_id,
          name: body.name ?? undefined,
          email: body.email === undefined ? undefined : body.email,
          phone: body.phone === undefined ? undefined : body.phone,
          title: body.title === undefined ? undefined : body.title,
          ownerId: body.owner_id === undefined ? undefined : body.owner_id,
        })
        .where(eq(contacts.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Contact not found");

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
      const [existing] = await db.select({ orgId: contacts.orgId }).from(contacts).where(eq(contacts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "contact", "delete");
      const [deleted] = await db.delete(contacts).where(eq(contacts.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Contact not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
