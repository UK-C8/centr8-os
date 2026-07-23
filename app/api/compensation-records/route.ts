import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { compensationRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireCompensationViewAccess } from "@/lib/api/employees";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) throw new ApiError(400, "employee_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, employeeId));
      if (!emp) return undefined;
      await requireCompensationViewAccess(db, userId, emp.orgId);
      return db.select().from(compensationRecords).where(eq(compensationRecords.employeeId, employeeId));
    });
    if (rows === undefined) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// HR admin only — creating/editing a compensation record is never
// self-service, unlike viewing (an employee can see but not set their own
// salary).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id || body.base_salary === undefined || !body.effective_date) {
      throw new ApiError(400, "employee_id, base_salary, and effective_date are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;

      await requirePermission(db, userId, emp.orgId, "compensation", "create");

      const [created] = await db
        .insert(compensationRecords)
        .values({
          orgId: emp.orgId,
          employeeId: body.employee_id,
          baseSalary: body.base_salary,
          currency: body.currency ?? undefined,
          effectiveDate: body.effective_date,
          bonus: body.bonus ?? null,
          benefits: body.benefits ?? null,
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
