import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// Neon has no built-in `auth` schema — 0000_auth_compat.sql defines
// auth.uid() and auth.user_org_ids() as Neon-side equivalents of Supabase's
// helpers, driven by a `request.jwt.claim.sub` session var the app sets
// per request. All policies below key off auth.user_org_ids().
const inUserOrgs = sql`org_id in (select * from auth.user_org_ids())`;

export const actorTypeEnum = pgEnum("actor_type", ["human", "ai"]);

// Built-in role names seeded into `permissions` (0009_seed_default_permissions.sql).
// org_memberships.role is plain text, not this enum, so an org admin can
// assign any custom role name — FR-1.3 requires custom roles, which rules
// out a closed Postgres enum for the column itself.
export const BUILT_IN_ROLES = ["owner", "admin", "member", "viewer"] as const;

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    brandingConfig: jsonb("branding_config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("organizations_isolation", {
      for: "all",
      to: authenticatedRole,
      using: sql`id in (select * from auth.user_org_ids())`,
      withCheck: sql`id in (select * from auth.user_org_ids())`,
    }),
  ],
).enableRLS();

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentDepartmentId: uuid("parent_department_id"),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("departments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("teams_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const orgMemberships = pgTable(
  "org_memberships",
  {
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  },
  (table) => [
    pgPolicy("org_memberships_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    primaryKey({ columns: [table.userId, table.orgId] }),
  ],
).enableRLS();

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id"),
    actorType: actorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("audit_log_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Work hierarchy (FR-2.x): Goals -> Portfolios -> Projects -> Milestones -> Sprints -> Tasks ---

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]);
export const sprintStatusEnum = pgEnum("sprint_status", ["planned", "active", "completed"]);
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const dependencyTypeEnum = pgEnum("dependency_type", ["blocks", "blocked_by"]);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id"),
  },
  () => [
    pgPolicy("goals_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("portfolios_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: projectStatusEnum("status").notNull().default("planning"),
    startDate: date("start_date"),
    endDate: date("end_date"),
  },
  () => [
    pgPolicy("projects_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueDate: date("due_date"),
  },
  () => [
    pgPolicy("milestones_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: sprintStatusEnum("status").notNull().default("planned"),
  },
  () => [
    pgPolicy("sprints_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sprintId: uuid("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("backlog"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id"),
    estimate: integer("estimate"),
  },
  () => [
    pgPolicy("tasks_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// task_dependencies has no org_id column (per spec) — it's a pure edge table
// between two tasks, so isolation is enforced by joining back to tasks
// rather than the usual org_id-in-user_org_ids() check.
const dependencyEndpointsInUserOrgs = sql`
  exists (
    select 1 from tasks t
    where t.id = task_dependencies.task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
  and exists (
    select 1 from tasks t
    where t.id = task_dependencies.depends_on_task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
`;

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: dependencyTypeEnum("type").notNull(),
  },
  (table) => [
    pgPolicy("task_dependencies_isolation", {
      for: "all",
      to: authenticatedRole,
      using: dependencyEndpointsInUserOrgs,
      withCheck: dependencyEndpointsInUserOrgs,
    }),
    primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    check("task_dependencies_no_self_reference", sql`${table.taskId} <> ${table.dependsOnTaskId}`),
  ],
).enableRLS();

// templates.org_id is nullable: null == a global template visible to every
// org. Anyone can read global templates, but only service_role (bypassing
// RLS) can write one — the mutation policy still requires org_id to be in
// the caller's own orgs, same as everywhere else.
export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    structure: jsonb("structure").notNull().default({}),
  },
  () => [
    pgPolicy("templates_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`org_id is null or org_id in (select * from auth.user_org_ids())`,
    }),
    pgPolicy("templates_write", {
      for: "insert",
      to: authenticatedRole,
      withCheck: inUserOrgs,
    }),
    pgPolicy("templates_update", {
      for: "update",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    pgPolicy("templates_delete", {
      for: "delete",
      to: authenticatedRole,
      using: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Permissions (FR-1.3): role -> allowed actions per resource type ---

export const resourceTypeEnum = pgEnum("resource_type", [
  "organization",
  "department",
  "team",
  "goal",
  "project",
  "milestone",
  "sprint",
  "task",
  "task_dependency",
  "project_health_snapshot",
]);
export const permissionActionEnum = pgEnum("permission_action", [
  "create",
  "read",
  "update",
  "delete",
]);

// org_id nullable, same pattern as `templates`: null rows are the built-in
// role defaults (owner/admin/member/viewer) visible to every org. An org
// defining a custom role (any role name not in BUILT_IN_ROLES) adds its own
// org_id-scoped rows here — requirePermission() (lib/api/permissions.ts)
// checks both scopes, so an org-specific grant/deny always coexists with,
// rather than requires editing, the global defaults.
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    action: permissionActionEnum("action").notNull(),
  },
  () => [
    pgPolicy("permissions_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`org_id is null or org_id in (select * from auth.user_org_ids())`,
    }),
    pgPolicy("permissions_write", {
      for: "insert",
      to: authenticatedRole,
      withCheck: inUserOrgs,
    }),
    pgPolicy("permissions_update", {
      for: "update",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    pgPolicy("permissions_delete", {
      for: "delete",
      to: authenticatedRole,
      using: inUserOrgs,
    }),
  ],
).enableRLS();

// --- AI health monitoring (FR-8.x subset), Tier 0 — read-only signal ---
// A snapshot is an immutable point-in-time record: computed signals (task/
// sprint counts, overdue/blocked tallies) plus a Gemini-written plain-
// language summary. Nothing here ever writes to goals/projects/milestones/
// sprints/tasks — see app/api/ai/project-health/route.ts.
export const projectHealthSnapshots = pgTable(
  "project_health_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    signals: jsonb("signals").notNull().default({}),
    aiSummary: text("ai_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("project_health_snapshots_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();
