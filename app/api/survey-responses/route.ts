import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { engagementSurveys, surveyResponses } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const surveyId = req.nextUrl.searchParams.get("survey_id");
    if (!surveyId) throw new ApiError(400, "survey_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [survey] = await db.select({ orgId: engagementSurveys.orgId }).from(engagementSurveys).where(eq(engagementSurveys.id, surveyId));
      if (!survey) return undefined;
      await requirePermission(db, userId, survey.orgId, "engagement", "read");
      return db.select().from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId));
    });
    if (rows === undefined) throw new ApiError(404, "Survey not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// HR-admin data entry, same as every other HR module in this app — a
// response is recorded on an employee's behalf (or with anonymous:true
// and no employee_id at all) rather than submitted by the respondent
// through their own login, since HR Management has no employee
// self-service login path.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.survey_id || !body.answers) throw new ApiError(400, "survey_id and answers are required");

    const row = await withOrgContext(userId, async (db) => {
      const [survey] = await db.select({ orgId: engagementSurveys.orgId }).from(engagementSurveys).where(eq(engagementSurveys.id, body.survey_id));
      if (!survey) return undefined;
      await requirePermission(db, userId, survey.orgId, "engagement", "create");

      const anonymous = body.anonymous === true;
      const [created] = await db
        .insert(surveyResponses)
        .values({
          orgId: survey.orgId,
          surveyId: body.survey_id,
          employeeId: anonymous ? null : (body.employee_id ?? null),
          answers: body.answers,
          anonymous,
        })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Survey not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
