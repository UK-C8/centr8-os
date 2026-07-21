import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const [row] = await withOrgContext(userId, (db) =>
      db.select().from(projects).where(eq(projects.id, id)),
    );
    if (!row) throw new ApiError(404, "Project not found");

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
        .select({ orgId: projects.orgId })
        .from(projects)
        .where(eq(projects.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "project", "update");

      const [updated] = await db
        .update(projects)
        .set({
          name: body.name ?? undefined,
          status: body.status ?? undefined,
          portfolioId: body.portfolio_id === undefined ? undefined : body.portfolio_id,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
        })
        .where(eq(projects.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Project not found");

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
        .select({ orgId: projects.orgId })
        .from(projects)
        .where(eq(projects.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "project", "delete");

      const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Project not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
