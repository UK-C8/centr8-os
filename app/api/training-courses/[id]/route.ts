import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCourses } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: trainingCourses.orgId }).from(trainingCourses).where(eq(trainingCourses.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "training", "update");

      const [updated] = await db
        .update(trainingCourses)
        .set({
          title: body.title ?? undefined,
          content: body.content ?? undefined,
          requiredForRole: body.required_for_role === undefined ? undefined : body.required_for_role,
        })
        .where(eq(trainingCourses.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Training course not found");

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
      const [existing] = await db.select({ orgId: trainingCourses.orgId }).from(trainingCourses).where(eq(trainingCourses.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "training", "delete");
      const [deleted] = await db.delete(trainingCourses).where(eq(trainingCourses.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Training course not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
