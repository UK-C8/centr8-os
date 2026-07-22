import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgMemberships } from "@/db/schema";
import { ApiKeyError, requireApiKeyOrgId } from "@/lib/api/apiKeys";
import { findAuthUserByEmail, scimAdminClient, scimError, toScimUser } from "@/lib/api/scim";

// GET /api/scim/v2/Users — list, with minimal `filter=userName eq "..."`
// support (IdPs check-then-create; without this every sync run would
// re-POST and 409 instead of finding the existing user).
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireApiKeyOrgId(req);
    const filter = req.nextUrl.searchParams.get("filter");
    const emailMatch = filter?.match(/userName eq "([^"]+)"/i)?.[1];

    const rows = await db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId));
    const supabase = scimAdminClient();

    const resources = [];
    for (const row of rows) {
      const { data } = await supabase.auth.admin.getUserById(row.userId);
      const email = data.user?.email;
      if (!email) continue;
      if (emailMatch && email.toLowerCase() !== emailMatch.toLowerCase()) continue;
      resources.push(toScimUser(row.userId, email, row));
    }

    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: resources.length,
      Resources: resources,
    });
  } catch (err) {
    if (err instanceof ApiKeyError) return scimError(err.status, err.message);
    console.error(err);
    return scimError(500, "Internal server error");
  }
}

// POST /api/scim/v2/Users — find-or-create the Supabase Auth account (a
// SCIM-provisioned user has no password; they'll authenticate via SSO
// once that's live, or a magic link in the meantime), then add the
// org_membership. 409s if already a member, matching RFC 7644 §3.3.
export async function POST(req: NextRequest) {
  try {
    const orgId = await requireApiKeyOrgId(req);
    const body = await req.json();
    const email = body.userName ?? body.emails?.[0]?.value;
    if (!email) return scimError(400, "userName (email) is required");

    const supabase = scimAdminClient();
    let authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
      if (error) return scimError(500, error.message);
      authUser = data.user;
    }

    const [existing] = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.userId, authUser.id));
    if (existing && existing.orgId === orgId) {
      return scimError(409, "User is already provisioned in this organization");
    }

    const active = body.active !== false;
    const [membership] = await db
      .insert(orgMemberships)
      .values({
        userId: authUser.id,
        orgId,
        role: "member",
        deactivatedAt: active ? null : new Date(),
      })
      .returning();

    return NextResponse.json(toScimUser(authUser.id, email, membership), { status: 201 });
  } catch (err) {
    if (err instanceof ApiKeyError) return scimError(err.status, err.message);
    console.error(err);
    return scimError(500, "Internal server error");
  }
}
