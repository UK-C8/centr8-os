import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { clientPortalAccess } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Revoke, not hard-delete — same reasoning as api_keys' DELETE (Prompt
// 3.2): keeps the row for the audit trail, sets revoked_at so
// requirePortalGrant() rejects it immediately.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: clientPortalAccess.orgId })
        .from(clientPortalAccess)
        .where(eq(clientPortalAccess.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "portal", "configure");

      const [revoked] = await db
        .update(clientPortalAccess)
        .set({ revokedAt: new Date() })
        .where(eq(clientPortalAccess.id, id))
        .returning({ id: clientPortalAccess.id, revokedAt: clientPortalAccess.revokedAt });
      return revoked;
    });
    if (!row) throw new ApiError(404, "Portal access grant not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
