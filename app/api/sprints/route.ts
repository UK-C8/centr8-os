import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { sprints } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const projectId = req.nextUrl.searchParams.get("project_id");
    if (!projectId) throw new ApiError(400, "project_id is required");

    const rows = await withOrgContext(userId, (db) =>
      db.select().from(sprints).where(eq(sprints.projectId, projectId)),
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

    if (!body.org_id || !body.project_id || !body.name) {
      throw new ApiError(400, "org_id, project_id and name are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "sprint", "create");
      return db
        .insert(sprints)
        .values({
          orgId: body.org_id,
          projectId: body.project_id,
          name: body.name,
          startDate: body.start_date ?? null,
          endDate: body.end_date ?? null,
          status: body.status ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
