import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orgMemberships } from "@/db/schema";
import { ApiKeyError, requireApiKeyOrgId } from "@/lib/api/apiKeys";
import { getMembership, scimAdminClient, scimError, toScimUser } from "@/lib/api/scim";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const orgId = await requireApiKeyOrgId(req);
    const { id } = await params;

    const membership = await getMembership(orgId, id);
    if (!membership) return scimError(404, "User not found");

    const { data } = await scimAdminClient().auth.admin.getUserById(id);
    if (!data.user?.email) return scimError(404, "User not found");

    return NextResponse.json(toScimUser(id, data.user.email, membership));
  } catch (err) {
    if (err instanceof ApiKeyError) return scimError(err.status, err.message);
    console.error(err);
    return scimError(500, "Internal server error");
  }
}

// PATCH — the standard SCIM deprovisioning request shape most IdPs send:
// { "Operations": [{ "op": "replace", "path": "active", "value": false }] }.
// Only that one op/path is handled; anything else is a no-op rather than
// an error, since IdPs commonly bundle a harmless "replace path:userName"
// alongside the active toggle and shouldn't get a hard failure for it.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const orgId = await requireApiKeyOrgId(req);
    const { id } = await params;
    const body = await req.json();

    const membership = await getMembership(orgId, id);
    if (!membership) return scimError(404, "User not found");

    const activeOp = (body.Operations ?? []).find(
      (op: { op?: string; path?: string }) => op.op?.toLowerCase() === "replace" && op.path === "active",
    );

    let updated = membership;
    if (activeOp) {
      const active = activeOp.value !== false;
      [updated] = await db
        .update(orgMemberships)
        .set({ deactivatedAt: active ? null : new Date() })
        .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, id)))
        .returning();
    }

    const { data } = await scimAdminClient().auth.admin.getUserById(id);
    if (!data.user?.email) return scimError(404, "User not found");

    return NextResponse.json(toScimUser(id, data.user.email, updated));
  } catch (err) {
    if (err instanceof ApiKeyError) return scimError(err.status, err.message);
    console.error(err);
    return scimError(500, "Internal server error");
  }
}

// DELETE — full removal (RFC 7644 §3.6), distinct from PATCH active:false.
// Only removes the org_membership row, never the underlying Supabase Auth
// account (which may belong to other orgs).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const orgId = await requireApiKeyOrgId(req);
    const { id } = await params;

    const membership = await getMembership(orgId, id);
    if (!membership) return scimError(404, "User not found");

    await db.delete(orgMemberships).where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, id)));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiKeyError) return scimError(err.status, err.message);
    console.error(err);
    return scimError(500, "Internal server error");
  }
}
