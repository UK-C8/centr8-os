import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { orgMemberships } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ userId: string }> };

// Role change and/or deactivate/reactivate. Deactivate reuses the same
// org_memberships.deactivatedAt column SCIM deprovisioning (Prompt 3.3)
// already set up — RLS-level access (auth.user_org_ids()) and permission
// checks both already treat a deactivated membership as gone, so this
// path gets that revocation for free.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId: targetUserId } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "organization", "update");

      const [updated] = await db
        .update(orgMemberships)
        .set({
          role: body.role ?? undefined,
          deactivatedAt: body.deactivated === undefined ? undefined : body.deactivated ? new Date() : null,
        })
        .where(and(eq(orgMemberships.userId, targetUserId), eq(orgMemberships.orgId, orgId)))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Member not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
