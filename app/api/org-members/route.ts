// Members & Roles (CLAUDE.md §11a Administration). Gated on "organization":
// "update" — already owner/admin-only in the default permission matrix
// (0008_seed_default_permissions.sql), so managing membership doesn't need
// its own resourceType/action pair and the two-migration enum dance that
// comes with one.
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { orgMemberships } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { supabaseAdminClient, findAuthUserByEmail } from "@/lib/api/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "organization", "update");
      return db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId));
    });

    const supabase = supabaseAdminClient();
    const members = await Promise.all(
      rows.map(async (row) => {
        const { data } = await supabase.auth.admin.getUserById(row.userId);
        return {
          userId: row.userId,
          email: data.user?.email ?? null,
          role: row.role,
          deactivatedAt: row.deactivatedAt,
        };
      }),
    );

    return NextResponse.json({ data: members });
  } catch (err) {
    return handleApiError(err);
  }
}

// Invite — finds or creates the Supabase Auth account (inviteUserByEmail
// sends Supabase's own invite email with a magic link; if the account
// already exists, falls back to just adding the membership so a returning
// person can be re-added to a new org without a duplicate-account error).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.email || !body.role) {
      throw new ApiError(400, "org_id, email, and role are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "organization", "update");

      const supabase = supabaseAdminClient();
      let authUserId: string;
      const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(body.email);
      if (invited.user) {
        authUserId = invited.user.id;
      } else if (inviteErr?.message.includes("already been registered")) {
        const existing = await findAuthUserByEmail(body.email);
        if (!existing) throw new ApiError(500, "Could not resolve existing account");
        authUserId = existing.id;
      } else {
        throw new ApiError(500, inviteErr?.message ?? "Failed to invite user");
      }

      const [created] = await db
        .insert(orgMemberships)
        .values({ userId: authUserId, orgId: body.org_id, role: body.role })
        .onConflictDoUpdate({
          target: [orgMemberships.userId, orgMemberships.orgId],
          set: { role: body.role, deactivatedAt: null },
        })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
