import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCompletions, trainingCourses } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const courseId = req.nextUrl.searchParams.get("course_id");
    if (!courseId) throw new ApiError(400, "course_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [course] = await db.select({ orgId: trainingCourses.orgId }).from(trainingCourses).where(eq(trainingCourses.id, courseId));
      if (!course) return undefined;
      await requirePermission(db, userId, course.orgId, "training", "read");
      return db.select().from(trainingCompletions).where(eq(trainingCompletions.courseId, courseId));
    });
    if (rows === undefined) throw new ApiError(404, "Training course not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.course_id || !body.employee_id) throw new ApiError(400, "course_id and employee_id are required");

    const row = await withOrgContext(userId, async (db) => {
      const [course] = await db.select({ orgId: trainingCourses.orgId }).from(trainingCourses).where(eq(trainingCourses.id, body.course_id));
      if (!course) return undefined;
      await requirePermission(db, userId, course.orgId, "training", "create");

      const [created] = await db
        .insert(trainingCompletions)
        .values({ orgId: course.orgId, employeeId: body.employee_id, courseId: body.course_id })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Training course not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
