import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { apiKeys } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateApiKey } from "@/lib/api/apiKeys";

// List — never returns keyHash, only metadata. Lets the UI show "created,
// last used, revoked" without ever re-exposing the secret.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "api_key", "read");
      return db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, orgId))
        .orderBy(desc(apiKeys.createdAt));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// The raw key is returned exactly once, here — it's never retrievable
// again (only its hash is stored). The UI must show it in a "copy this
// now" dialog.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.name) throw new ApiError(400, "org_id and name are required");

    const { raw, hash } = generateApiKey();

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "api_key", "create");
      return db
        .insert(apiKeys)
        .values({ orgId: body.org_id, name: body.name, keyHash: hash })
        .returning({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt });
    });

    return NextResponse.json({ data: { ...row, key: raw } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
