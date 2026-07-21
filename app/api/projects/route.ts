import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    const portfolioId = req.nextUrl.searchParams.get("portfolio_id");

    const conditions = [
      orgId ? eq(projects.orgId, orgId) : undefined,
      portfolioId ? eq(projects.portfolioId, portfolioId) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await withOrgContext(userId, (db) =>
      conditions.length ? db.select().from(projects).where(and(...conditions)) : db.select().from(projects),
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.name) {
      throw new ApiError(400, "org_id and name are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project", "create");
      return db
        .insert(projects)
        .values({
          orgId: body.org_id,
          portfolioId: body.portfolio_id ?? null,
          name: body.name,
          status: body.status ?? undefined,
          startDate: body.start_date ?? null,
          endDate: body.end_date ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
