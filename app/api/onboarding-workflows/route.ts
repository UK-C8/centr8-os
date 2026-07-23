import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, onboardingWorkflows } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireEmployeeManageAccess } from "@/lib/api/employees";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) throw new ApiError(400, "employee_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, employeeId));
      if (!emp) return undefined;
      await requireEmployeeManageAccess(db, userId, emp.orgId, employeeId);
      return db.select().from(onboardingWorkflows).where(eq(onboardingWorkflows.employeeId, employeeId));
    });
    if (rows === undefined) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id) throw new ApiError(400, "employee_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db
        .select({ orgId: employees.orgId })
        .from(employees)
        .where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;
      await requireEmployeeManageAccess(db, userId, emp.orgId, body.employee_id);

      const [created] = await db
        .insert(onboardingWorkflows)
        .values({
          orgId: emp.orgId,
          employeeId: body.employee_id,
          templateId: body.template_id ?? null,
          steps: body.steps ?? [],
          status: body.status ?? undefined,
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
