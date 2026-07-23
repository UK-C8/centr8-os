import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { jobPostings } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "recruitment", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Job posting not found");

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
      const [existing] = await db.select({ orgId: jobPostings.orgId }).from(jobPostings).where(eq(jobPostings.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "recruitment", "update");

      const [updated] = await db
        .update(jobPostings)
        .set({
          title: body.title ?? undefined,
          departmentId: body.department_id === undefined ? undefined : body.department_id,
          status: body.status ?? undefined,
          description: body.description === undefined ? undefined : body.description,
        })
        .where(eq(jobPostings.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Job posting not found");

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
      const [existing] = await db.select({ orgId: jobPostings.orgId }).from(jobPostings).where(eq(jobPostings.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "recruitment", "delete");
      const [deleted] = await db.delete(jobPostings).where(eq(jobPostings.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Job posting not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
