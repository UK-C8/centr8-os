// Prompt 6.1 — converting a lead into an account + contact is an explicit
// action, not automatic (per the prompt), so it gets its own audit_log
// entry the same way milestone approval does (lib/api/milestoneApproval.ts)
// — a one-way state transition that creates new records is consequential
// enough to record, unlike ordinary CRUD.
import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { accounts, auditLog, contacts, leads } from "@/db/schema";

export async function convertLead(db: OrgScopedDb, leadId: string, orgId: string, userId: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead || lead.orgId !== orgId) return null;
  if (lead.status === "converted") return lead; // idempotent — re-converting is a no-op, not an error

  const [account] = await db
    .insert(accounts)
    .values({
      orgId,
      name: lead.company || lead.name,
      ownerId: lead.ownerId,
    })
    .returning();

  const [contact] = await db
    .insert(contacts)
    .values({
      orgId,
      accountId: account.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      ownerId: lead.ownerId,
    })
    .returning();

  const [updatedLead] = await db
    .update(leads)
    .set({ status: "converted", convertedAccountId: account.id, convertedContactId: contact.id })
    .where(eq(leads.id, leadId))
    .returning();

  await db.insert(auditLog).values({
    orgId,
    actorUserId: userId,
    actorType: "human",
    action: "lead_converted",
    targetType: "lead",
    targetId: leadId,
    metadata: { accountId: account.id, contactId: contact.id },
  });

  return { lead: updatedLead, account, contact };
}
