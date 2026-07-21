// FR-4.x (Prompt 3.1) task 3 — Tier 1 client-approval action, shared by
// both approval entry points so the audit_log entry is identical either
// way: an internal org member (app/api/milestones/[id]/approve, RBAC-
// gated via can("milestone", "approve")) and an external client
// (app/api/portal/[org_slug]/milestones/[id]/approve, token-gated per
// lib/api/portalAccess.ts — token possession is the authorization there,
// same as the rest of the portal, not layered with requirePermission()).
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { auditLog, milestones } from "@/db/schema";
import type * as schema from "@/db/schema";

type Approver = { type: "human"; userId: string } | { type: "client"; clientAccessId: string; clientName: string };

// Accepts either db handle: the RBAC route runs inside withOrgContext's
// per-user OrgScopedDb, the portal route (no user session to scope) uses
// db/index.ts's plain NeonHttpDatabase — see lib/api/portalAccess.ts.
export async function approveMilestone(
  db: OrgScopedDb | NeonHttpDatabase<typeof schema>,
  milestoneId: string,
  orgId: string,
  approver: Approver,
) {
  const [existing] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
  if (!existing || existing.orgId !== orgId) return null;
  if (existing.approvedAt) return existing; // idempotent — re-approving is a no-op, not an error

  const [updated] = await db
    .update(milestones)
    .set({
      approvedAt: new Date(),
      approvedByUserId: approver.type === "human" ? approver.userId : null,
      approvedByClientAccessId: approver.type === "client" ? approver.clientAccessId : null,
    })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await db.insert(auditLog).values({
    orgId,
    actorUserId: approver.type === "human" ? approver.userId : null,
    actorType: "human", // a client is a human, not the "ai" actor_type
    action: "milestone_approved",
    targetType: "milestone",
    targetId: milestoneId,
    metadata: {
      tier: "tier_1",
      approvedBy: approver.type === "client" ? { clientAccessId: approver.clientAccessId, clientName: approver.clientName } : { userId: approver.userId },
    },
  });

  return updated;
}
