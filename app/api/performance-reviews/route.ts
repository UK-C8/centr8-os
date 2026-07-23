import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { performanceReviews } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "performance", "read");
      return db
        .select()
        .from(performanceReviews)
        .where(employeeId ? eq(performanceReviews.employeeId, employeeId) : eq(performanceReviews.orgId, orgId));
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
    if (!body.org_id || !body.employee_id || !body.period) {
      throw new ApiError(400, "org_id, employee_id, and period are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "performance", "create");
      return db
        .insert(performanceReviews)
        .values({
          orgId: body.org_id,
          employeeId: body.employee_id,
          reviewerId: body.reviewer_id ?? null,
          period: body.period,
          ratings: body.ratings ?? {},
          comments: body.comments ?? null,
          status: body.status ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
