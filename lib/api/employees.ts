// Prompt 5.1/5.2 — several employee-scoped actions (onboarding, leave
// approval) aren't role-permission-grid entries ("the employee's manager"
// isn't a role), so they're checked here: a role-grid permission (HR admin)
// OR the current user is the target employee's manager (employees.managerId
// -> that manager's employees.userId matches the caller).
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission, type PermissionAction, type ResourceType } from "./permissions";

export async function isManagerOf(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<boolean> {
  const [target] = await db
    .select({ managerId: employees.managerId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, orgId)));
  if (!target?.managerId) return false;

  const [manager] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, target.managerId));
  return manager?.userId === userId;
}

async function requireRoleOrManager(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  employeeId: string,
  resourceType: ResourceType,
  action: PermissionAction,
  errorMessage: string,
): Promise<void> {
  try {
    await requirePermission(db, userId, orgId, resourceType, action);
    return;
  } catch {
    // fall through to the manager check below
  }
  if (!(await isManagerOf(db, userId, orgId, employeeId))) {
    throw new ApiError(403, errorMessage);
  }
}

export function requireEmployeeManageAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string) {
  return requireRoleOrManager(
    db,
    userId,
    orgId,
    employeeId,
    "employee",
    "update",
    "Not authorized to manage this employee's onboarding",
  );
}

export function requireLeaveApproveAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string) {
  return requireRoleOrManager(
    db,
    userId,
    orgId,
    employeeId,
    "leave",
    "approve",
    "Not authorized to approve this employee's leave request",
  );
}

// Prompt 5.2 — attendance check-in/out and leave requests are always
// self-scoped: the role grant (attendance:record / leave:request) says
// "this role may record/request at all," but not "for anyone" — the
// caller must actually BE the employees.userId behind the target
// employeeId. There's no HR-admin-does-it-for-someone-else path here.
export async function requireSelfEmployee(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  employeeId: string,
): Promise<void> {
  const [target] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, orgId)));
  if (!target || target.userId !== userId) {
    throw new ApiError(403, "You can only do this for your own employee record");
  }
}
