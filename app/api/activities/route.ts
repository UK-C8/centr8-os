import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { activities } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const relatedType = req.nextUrl.searchParams.get("related_type");
    const relatedId = req.nextUrl.searchParams.get("related_id");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "activity", "read");
      const conditions = [eq(activities.orgId, orgId)];
      if (relatedType) conditions.push(eq(activities.relatedType, relatedType as (typeof activities.relatedType.enumValues)[number]));
      if (relatedId) conditions.push(eq(activities.relatedId, relatedId));
      return db.select().from(activities).where(and(...conditions));
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
    if (!body.org_id || !body.related_type || !body.related_id || !body.type) {
      throw new ApiError(400, "org_id, related_type, related_id, and type are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "activity", "create");
      return db
        .insert(activities)
        .values({
          orgId: body.org_id,
          relatedType: body.related_type,
          relatedId: body.related_id,
          type: body.type,
          notes: body.notes ?? null,
          dueDate: body.due_date ?? null,
          completed: body.completed ?? false,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
