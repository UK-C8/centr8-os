import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, organizations } from "@/db/schema";
import { PortalAccessError, requirePortalGrant } from "@/lib/api/portalAccess";
import { approveMilestone } from "@/lib/api/milestoneApproval";

type Params = { params: Promise<{ org_slug: string; id: string }> };

// Client-facing counterpart to app/api/milestones/[id]/approve — token-
// gated (possession of a valid, unrevoked link is the authorization,
// same as the rest of the portal), not RBAC-gated, since a client has no
// org_memberships row for can()/requirePermission() to check.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { org_slug, id } = await params;
    const body = await req.json().catch(() => ({}));
    const token = body.token ?? req.nextUrl.searchParams.get("token");

    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, org_slug));
    if (!org) return NextResponse.json({ error: "Portal not found" }, { status: 404 });

    const grant = await requirePortalGrant(token);
    if (grant.orgId !== org.id) {
      return NextResponse.json({ error: "This access link doesn't belong to this portal" }, { status: 403 });
    }

    // The milestone must belong to the exact project this grant covers —
    // checked *before* approving, so a client can never approve a
    // milestone outside their one granted project by passing a different
    // milestone id (same org, different project) in the URL.
    const [target] = await db.select({ projectId: milestones.projectId }).from(milestones).where(eq(milestones.id, id));
    if (!target || target.projectId !== grant.projectId) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const row = await approveMilestone(db, id, grant.orgId, {
      type: "client",
      clientAccessId: grant.id,
      clientName: grant.clientName,
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof PortalAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
