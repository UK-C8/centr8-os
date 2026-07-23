import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "employee", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

// employment_status -> 'terminated' is gated by "employee:terminate"
// (distinct from ordinary field edits), same reasoning as milestone
// approval getting its own "approve" action rather than riding on
// "update" — terminating someone is a materially different action from
// editing their job title.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    const terminating = body.employment_status === "terminated";

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "employee", terminating ? "terminate" : "update");

      const [updated] = await db
        .update(employees)
        .set({
          fullName: body.full_name ?? undefined,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          departmentId: body.department_id === undefined ? undefined : body.department_id,
          teamId: body.team_id === undefined ? undefined : body.team_id,
          managerId: body.manager_id === undefined ? undefined : body.manager_id,
          employmentStatus: body.employment_status ?? undefined,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
        })
        .where(eq(employees.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Employee not found");

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
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "employee", "delete");

      const [deleted] = await db.delete(employees).where(eq(employees.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
