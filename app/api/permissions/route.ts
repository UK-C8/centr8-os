import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { orgMemberships, permissions } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

// Prompt 1.4 task 4: the UI needs to hide/disable actions a role can't
// perform, sourced from the same table-driven `permissions` data
// requirePermission() (lib/api/permissions.ts) enforces server-side —
// not a hardcoded role name check, so a custom role or an org-specific
// override (both of which `permissions` already supports) is reflected in
// the UI too, not just enforced silently on the backend.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      const [membership] = await db
        .select({ role: orgMemberships.role })
        .from(orgMemberships)
        .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, orgId)));

      if (!membership) throw new ApiError(403, "Not a member of this organization");

      return db
        .select({ resourceType: permissions.resourceType, action: permissions.action })
        .from(permissions)
        .where(
          and(
            or(eq(permissions.orgId, orgId), isNull(permissions.orgId)),
            eq(permissions.role, membership.role),
          ),
        );
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
