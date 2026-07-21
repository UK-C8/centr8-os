import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { clientPortalAccess } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generatePortalToken } from "@/lib/api/portalAccess";

// List — never returns tokenHash, only metadata. Scoped by project_id (a
// project's Settings tab is where grants are managed, same placement as
// Prompt 3.2's budget fields).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const projectId = req.nextUrl.searchParams.get("project_id");
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!projectId || !orgId) throw new ApiError(400, "project_id and org_id are required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "portal", "read");
      return db
        .select({
          id: clientPortalAccess.id,
          clientName: clientPortalAccess.clientName,
          hiddenFields: clientPortalAccess.hiddenFields,
          createdAt: clientPortalAccess.createdAt,
          revokedAt: clientPortalAccess.revokedAt,
        })
        .from(clientPortalAccess)
        .where(eq(clientPortalAccess.projectId, projectId))
        .orderBy(desc(clientPortalAccess.createdAt));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// The raw token is returned exactly once, here — same "copy this now"
// contract as Prompt 3.2's API keys (only the hash is ever stored).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.project_id || !body.client_name) {
      throw new ApiError(400, "org_id, project_id and client_name are required");
    }

    const { raw, hash } = generatePortalToken();
    const hiddenFields = Array.isArray(body.hidden_fields) ? body.hidden_fields : ["budget"];

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "portal", "configure");
      return db
        .insert(clientPortalAccess)
        .values({
          orgId: body.org_id,
          projectId: body.project_id,
          clientName: body.client_name,
          tokenHash: hash,
          hiddenFields,
        })
        .returning({ id: clientPortalAccess.id, clientName: clientPortalAccess.clientName, createdAt: clientPortalAccess.createdAt });
    });

    return NextResponse.json({ data: { ...row, token: raw } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
