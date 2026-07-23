// Prompt 5.2 — leave balance is computed on read, not stored: it's just
// policy.daysPerYear minus the sum of approved leave_requests date ranges
// for the current calendar year, so there's no risk of a stored balance
// drifting from the approvals that actually determine it.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";

function daysInclusive(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export async function computeLeaveBalance(
  db: OrgScopedDb,
  employeeId: string,
  policyId: string,
  daysPerYear: number,
): Promise<{ used: number; remaining: number }> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
    .from(leaveRequests)
    .where(
      and(eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.policyId, policyId), eq(leaveRequests.status, "approved")),
    );

  const used = rows
    .filter((r) => new Date(r.startDate).getFullYear() === year)
    .reduce((sum, r) => sum + daysInclusive(r.startDate, r.endDate), 0);

  return { used, remaining: daysPerYear - used };
}
