import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(accounts).where(eq(accounts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "account", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Account not found");

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
      const [existing] = await db.select({ orgId: accounts.orgId }).from(accounts).where(eq(accounts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "account", "update");

      const [updated] = await db
        .update(accounts)
        .set({
          name: body.name ?? undefined,
          industry: body.industry === undefined ? undefined : body.industry,
          website: body.website === undefined ? undefined : body.website,
          ownerId: body.owner_id === undefined ? undefined : body.owner_id,
        })
        .where(eq(accounts.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Account not found");

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
      const [existing] = await db.select({ orgId: accounts.orgId }).from(accounts).where(eq(accounts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "account", "delete");
      const [deleted] = await db.delete(accounts).where(eq(accounts.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Account not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
