import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireSelfEmployee } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

// Self check-out only — same self-scoping as POST /api/attendance.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: attendanceRecords.orgId, employeeId: attendanceRecords.employeeId })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "attendance", "record");
      await requireSelfEmployee(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(attendanceRecords)
        .set({
          checkOut: new Date(),
          status: body.status ?? undefined,
        })
        .where(eq(attendanceRecords.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Attendance record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
