import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireSelfEmployee } from "@/lib/api/employees";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) throw new ApiError(400, "employee_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, employeeId));
      if (!emp) return undefined;
      await requirePermission(db, userId, emp.orgId, "employee", "read");
      return db.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employeeId));
    });
    if (rows === undefined) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// Self check-in — creates today's record if it doesn't exist yet.
// Check-out is a PATCH on the created record (app/api/attendance/[id]).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id) throw new ApiError(400, "employee_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;

      await requirePermission(db, userId, emp.orgId, "attendance", "record");
      await requireSelfEmployee(db, userId, emp.orgId, body.employee_id);

      const today = new Date().toISOString().slice(0, 10);
      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, body.employee_id), eq(attendanceRecords.date, today)));
      if (existing) throw new ApiError(409, "Already checked in today");

      const [created] = await db
        .insert(attendanceRecords)
        .values({
          orgId: emp.orgId,
          employeeId: body.employee_id,
          date: today,
          checkIn: new Date(),
          status: body.status ?? "present",
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
