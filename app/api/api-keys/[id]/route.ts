import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { apiKeys } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Revoke, not hard-delete — keeps the row (and its audit trail via
// last_used_at) but sets revoked_at so requireApiKeyOrgId() rejects it
// immediately. No "update" action exists for api_key (see 0018's seed
// comment) — this is the delete grant.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: apiKeys.orgId }).from(apiKeys).where(eq(apiKeys.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "api_key", "delete");

      const [revoked] = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning({ id: apiKeys.id, revokedAt: apiKeys.revokedAt });
      return revoked;
    });
    if (!row) throw new ApiError(404, "API key not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
