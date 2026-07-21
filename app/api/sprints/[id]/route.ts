import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { sprints } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const [row] = await withOrgContext(userId, (db) =>
      db.select().from(sprints).where(eq(sprints.id, id)),
    );
    if (!row) throw new ApiError(404, "Sprint not found");

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
      const [existing] = await db
        .select({ orgId: sprints.orgId })
        .from(sprints)
        .where(eq(sprints.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "sprint", "update");

      const [updated] = await db
        .update(sprints)
        .set({
          name: body.name ?? undefined,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
          status: body.status ?? undefined,
        })
        .where(eq(sprints.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Sprint not found");

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
        .select({ orgId: sprints.orgId })
        .from(sprints)
        .where(eq(sprints.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "sprint", "delete");

      const [deleted] = await db.delete(sprints).where(eq(sprints.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Sprint not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
