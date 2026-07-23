import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireSelfEmployee } from "@/lib/api/employees";

// Team leave visibility (task 3: "simple list view for team leave
// visibility") reads by org_id, gated by employee:read — the same broad
// read grant every role already has, since seeing who's out isn't
// sensitive the way approving is.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "employee", "read");
      return db
        .select()
        .from(leaveRequests)
        .where(employeeId ? eq(leaveRequests.employeeId, employeeId) : eq(leaveRequests.orgId, orgId));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id || !body.policy_id || !body.start_date || !body.end_date) {
      throw new ApiError(400, "employee_id, policy_id, start_date, and end_date are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;

      await requirePermission(db, userId, emp.orgId, "leave", "request");
      await requireSelfEmployee(db, userId, emp.orgId, body.employee_id);

      const [created] = await db
        .insert(leaveRequests)
        .values({
          orgId: emp.orgId,
          employeeId: body.employee_id,
          policyId: body.policy_id,
          startDate: body.start_date,
          endDate: body.end_date,
        })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
