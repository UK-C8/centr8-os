import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// employee_id -> that employee's full history. org_id -> org-wide records
// for a single date (default today), for the HR dashboard's "who's in
// today" view — never both unscoped, always one or the other.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!employeeId && !orgId) throw new ApiError(400, "employee_id or org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      if (employeeId) {
        const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, employeeId));
        if (!emp) return undefined;
        await requirePermission(db, userId, emp.orgId, "attendance", "record");
        return db.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employeeId));
      }

      await requirePermission(db, userId, orgId!, "attendance", "record");
      const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      return db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.orgId, orgId!), eq(attendanceRecords.date, date)));
    });
    if (rows === undefined) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// HR-admin data entry (confirmed scope decision: no employee self-service
// login for HR Management) — an HR admin records attendance on an
// employee's behalf. Creates today's record if it doesn't exist yet;
// check-out is a PATCH on the created record (app/api/attendance/[id]).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id) throw new ApiError(400, "employee_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;

      await requirePermission(db, userId, emp.orgId, "attendance", "record");

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
