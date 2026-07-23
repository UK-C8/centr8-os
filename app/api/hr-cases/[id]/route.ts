import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { hrCases } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: hrCases.orgId }).from(hrCases).where(eq(hrCases.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "hr_case", "update");

      const [updated] = await db
        .update(hrCases)
        .set({
          category: body.category ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          status: body.status ?? undefined,
          assignedTo: body.assigned_to === undefined ? undefined : body.assigned_to,
        })
        .where(eq(hrCases.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "HR case not found");

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
      const [existing] = await db.select({ orgId: hrCases.orgId }).from(hrCases).where(eq(hrCases.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "hr_case", "delete");
      const [deleted] = await db.delete(hrCases).where(eq(hrCases.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "HR case not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
