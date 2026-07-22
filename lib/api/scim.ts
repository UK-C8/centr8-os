// SCIM 2.0 user provisioning (Prompt 3.3 task 2). Supabase has no native
// SCIM support on any tier (confirmed before building this) — this is a
// custom REST API on top of Supabase Auth's admin API + org_memberships,
// scoped per org via the same api_keys bearer-token mechanism the finance
// export (Prompt 3.2) already uses (lib/api/apiKeys.ts's requireApiKeyOrgId).
//
// Deliberately a practical subset of RFC 7644, not full compliance —
// covers exactly what the prompt asks for (create/update/deactivate a
// user) and what real IdPs (Okta, Azure AD, OneLogin) actually send for
// that flow:
//   - GET  /api/scim/v2/Users            list, optional `filter=userName eq "..."` (equality only)
//   - POST /api/scim/v2/Users            create (find-or-create the Supabase Auth account, add org_membership)
//   - GET  /api/scim/v2/Users/:id        fetch one
//   - PATCH /api/scim/v2/Users/:id       "replace active" op only — the standard deprovisioning request shape
//   - DELETE /api/scim/v2/Users/:id      hard-remove the org_membership
// Not implemented: groups, bulk operations, the full SCIM filter grammar,
// PATCH ops beyond replace-active. Add them if a real IdP integration
// needs them — no evidence any does yet.
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { orgMemberships } from "@/db/schema";

export function scimAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function findAuthUserByEmail(email: string) {
  const supabase = scimAdminClient();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}

export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  active: boolean;
  emails: { value: string; primary: boolean }[];
  meta: { resourceType: "User"; created?: string; lastModified?: string };
}

export function toScimUser(userId: string, email: string, membership: { deactivatedAt: Date | null }): ScimUser {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: userId,
    userName: email,
    active: membership.deactivatedAt === null,
    emails: [{ value: email, primary: true }],
    meta: { resourceType: "User" },
  };
}

export function scimError(status: number, detail: string) {
  return NextResponse.json(
    { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(status), detail },
    { status },
  );
}

export async function getMembership(orgId: string, userId: string) {
  const [row] = await db
    .select()
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)));
  return row ?? null;
}
