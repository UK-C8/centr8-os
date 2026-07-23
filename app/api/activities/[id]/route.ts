import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { activities } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: activities.orgId }).from(activities).where(eq(activities.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "activity", "update");

      const [updated] = await db
        .update(activities)
        .set({
          notes: body.notes === undefined ? undefined : body.notes,
          dueDate: body.due_date === undefined ? undefined : body.due_date,
          completed: body.completed === undefined ? undefined : body.completed,
        })
        .where(eq(activities.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Activity not found");

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
      const [existing] = await db.select({ orgId: activities.orgId }).from(activities).where(eq(activities.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "activity", "delete");
      const [deleted] = await db.delete(activities).where(eq(activities.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Activity not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
