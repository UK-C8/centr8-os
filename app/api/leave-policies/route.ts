import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leavePolicies } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { computeLeaveBalance } from "@/lib/api/leave";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    // When employee_id is passed, each policy comes back with that
    // employee's used/remaining days for the current year attached —
    // avoids a second round trip for the common "show me my balance"
    // case in the leave request form.
    const employeeId = req.nextUrl.searchParams.get("employee_id");

    const rows = await withOrgContext(userId, async (db) => {
      // Every org member needs to see policy names/day counts to submit a
      // leave request — reading policies isn't gated behind leave:configure.
      await requirePermission(db, userId, orgId, "leave", "request");
      const policies = await db.select().from(leavePolicies).where(eq(leavePolicies.orgId, orgId));
      if (!employeeId) return policies;

      return Promise.all(
        policies.map(async (p) => ({
          ...p,
          balance: await computeLeaveBalance(db, employeeId, p.id, p.daysPerYear),
        })),
      );
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
    if (!body.org_id || !body.name || !body.days_per_year) {
      throw new ApiError(400, "org_id, name, and days_per_year are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "leave", "configure");
      return db
        .insert(leavePolicies)
        .values({
          orgId: body.org_id,
          name: body.name,
          daysPerYear: body.days_per_year,
          accrualRule: body.accrual_rule ?? {},
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
