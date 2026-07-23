import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { candidates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: candidates.orgId }).from(candidates).where(eq(candidates.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "recruitment", "update");

      const [updated] = await db
        .update(candidates)
        .set({
          name: body.name ?? undefined,
          email: body.email === undefined ? undefined : body.email,
          stage: body.stage ?? undefined,
        })
        .where(eq(candidates.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Candidate not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: candidates.orgId }).from(candidates).where(eq(candidates.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "recruitment", "delete");
      const [deleted] = await db.delete(candidates).where(eq(candidates.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Candidate not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
