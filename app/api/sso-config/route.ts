import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { ssoConfigurations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Prompt 3.3 — one row per org. GET returns null data if unconfigured
// (not a 404 — "no SSO set up yet" is a normal, expected state).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "sso", "read");
      const [existing] = await db.select().from(ssoConfigurations).where(eq(ssoConfigurations.orgId, orgId));
      return existing ?? null;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

// Upsert the IdP metadata. `enabled` is never accepted from the request
// body — see db/schema.ts's ssoConfigurations.enabled comment: it can
// only ever be true once the Supabase project is actually on the Team
// plan, which nothing in this app can verify or flip on its own.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "sso", "configure");
      const [existing] = await db.select({ orgId: ssoConfigurations.orgId }).from(ssoConfigurations).where(eq(ssoConfigurations.orgId, body.org_id));

      const values = {
        idpEntityId: body.idp_entity_id ?? null,
        idpSsoUrl: body.idp_sso_url ?? null,
        idpCertificate: body.idp_certificate ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(ssoConfigurations)
          .set(values)
          .where(eq(ssoConfigurations.orgId, body.org_id))
          .returning();
        return updated;
      }
      const [inserted] = await db
        .insert(ssoConfigurations)
        .values({ orgId: body.org_id, ...values })
        .returning();
      return inserted;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
