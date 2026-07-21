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

      const editingBudget = body.budget_allocated !== undefined || body.budget_spent !== undefined;
      const editingProjectFields =
        body.name !== undefined ||
        body.status !== undefined ||
        body.portfolio_id !== undefined ||
        body.start_date !== undefined ||
        body.end_date !== undefined;

      // Separate gate from "project:update" (Prompt 3.2) — budget fields
      // live on the same row, but an org could grant one without the
      // other (e.g. a future finance-only custom role), so each only
      // checks the permission it actually needs.
      if (editingProjectFields) {
        await requirePermission(db, userId, existing.orgId, "project", "update");
      }
      if (editingBudget) {
        await requirePermission(db, userId, existing.orgId, "budget", "update");
      }

      const [updated] = await db
        .update(projects)
        .set({
          name: body.name ?? undefined,
          status: body.status ?? undefined,
          portfolioId: body.portfolio_id === undefined ? undefined : body.portfolio_id,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
          budgetAllocated: body.budget_allocated === undefined ? undefined : body.budget_allocated,
          budgetSpent: body.budget_spent === undefined ? undefined : body.budget_spent,
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
