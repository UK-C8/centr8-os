import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
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
    // Prompt 3.3 — SCIM deprovisioning ("deactivate a user"). Kept as a
    // nullable timestamp rather than deleting the row outright, same
    // revoke-not-delete reasoning as api_keys.revokedAt / client_portal_
    // access.revokedAt: the membership's history (role, team) survives a
    // deactivation. requirePermission() below treats a deactivated
    // membership as if it doesn't exist.
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
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
    // FR-3.x (Prompt 3.2) — simple manual entry, no external finance
    // integration. Nullable: a project has no budget until someone sets
    // one. precision 12/scale 2 matches ordinary currency amounts.
    budgetAllocated: numeric("budget_allocated", { precision: 12, scale: 2, mode: "number" }),
    budgetSpent: numeric("budget_spent", { precision: 12, scale: 2, mode: "number" }),
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
    // FR-4.x (Prompt 3.1) task 3 — Tier 1 client-approval action. At most
    // one of the two approvedBy* columns is ever set: an internal org
    // member approves via app/api/milestones/[id]/approve, a client
    // approves via the token-authed app/api/portal/[org_slug]/milestones/
    // [id]/approve — both funnel through lib/api/milestoneApproval.ts so
    // the audit_log entry is identical either way.
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id"),
    approvedByClientAccessId: uuid("approved_by_client_access_id").references(() => clientPortalAccess.id, {
      onDelete: "set null",
    }),
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
  // FR-3.x (Prompt 3.2) — budget fields live on `projects` itself (no
  // separate row/table to protect), so "budget" only ever needs an
  // "update" grant. "capacity" and "api_key" are real tables below.
  "budget",
  "capacity",
  "api_key",
  // FR-4.x (Prompt 3.1) — client_portal_access grants live under their
  // own resource type ("configure" covers create/update/revoke as one
  // verb, same simplification "budget:update" used in Prompt 3.2).
  // "milestone" already exists above; it just gains the "approve" action.
  "portal",
  // Prompt 3.3 — SSO/SAML config. Named "sso" (a real resourceType, action
  // "configure") rather than the prompt's literal suggested permission
  // name "org:configure_sso" — a resource-specific action string would
  // break the whole point of a shared resourceType x action matrix.
  // Same tightness/shape as "portal" and "api_key": owner/admin only.
  "sso",
  // Prompt 5.1 (HR Management, CLAUDE.md §11a) — employee directory
  // records. Onboarding workflows aren't a separate resourceType: they're
  // gated by employee:update (HR admin) OR a direct manager check against
  // employees.managerId, not a role-permission-grid entry (see
  // lib/api/employees.ts).
  "employee",
  // Prompt 5.2 — attendance_records. Only ever needs "record" (an
  // employee punching their own in/out) — reads ride along on ordinary
  // employee-scoped fetches, no separate "read" grant needed.
  "attendance",
  // Prompt 5.2 — leave_requests + leave_policies. "request" (an employee
  // submitting/self-managing their own request) and "approve" (existing
  // action, reused — same verb milestone approval already uses) are the
  // two real actions; policy CRUD rides on the existing "configure"
  // action (owner/admin only), same shape as "sso"/"portal".
  "leave",
]);
export const permissionActionEnum = pgEnum("permission_action", [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "configure",
  // Prompt 5.1 — distinct from "delete": terminating an employee sets
  // employment_status to 'terminated' and end_date, the record stays
  // (same revoke-not-delete reasoning as org_memberships.deactivatedAt).
  "terminate",
  // Prompt 5.2 — an employee recording their own attendance or
  // submitting their own leave request isn't "create" in the ordinary
  // permission-grid sense (it's self-scoped, checked against
  // employees.userId in application code, same as onboarding's manager
  // check) — distinct verbs make that self-scoping explicit in the grid
  // rather than overloading "create" to mean two different things.
  "record",
  "request",
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

// --- Agent job queue (Prompt 2.1) ---
// CLAUDE.md §5/§6: five composable agents (Planner/Monitor/Analyst/Writer/
// Communicator), coordinated by a Railway worker polling this table via
// `SELECT ... FOR UPDATE SKIP LOCKED` (workers/agent-worker.ts) — not
// called inline from a Next.js request. API routes insert a row here and
// poll it for a result instead of calling Gemini directly.
export const agentTypeEnum = pgEnum("agent_type", [
  "planner",
  "monitor",
  "analyst",
  "writer",
  "communicator",
]);
// Mirrors CLAUDE.md §4's four autonomy tiers exactly (tier_0 = Suggest
// Only ... tier_3 = Full Autonomy) — every job is stamped with the tier
// the acting agent ran at, independent of the job's pass/fail outcome.
export const autonomyTierEnum = pgEnum("autonomy_tier", ["tier_0", "tier_1", "tier_2", "tier_3"]);
export const agentJobStatusEnum = pgEnum("agent_job_status", ["pending", "processing", "done", "failed"]);

export const agentJobs = pgTable(
  "agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentType: agentTypeEnum("agent_type").notNull(),
    // Free text, not an enum — mirrors audit_log.action's convention
    // (e.g. "create_project_draft", "project_health_scan") so adding a new
    // job type never needs a migration, only a new registry entry
    // (lib/agents/registry.ts).
    jobType: text("job_type").notNull(),
    tier: autonomyTierEnum("tier").notNull().default("tier_0"),
    status: agentJobStatusEnum("status").notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("agent_jobs_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Resource planning & budgeting (FR-3.x, Prompt 3.2) ---

// One row per person per sprint — "how many points/hours they're available
// for," set manually by a PM (no capacity-forecasting AI here, this is
// Tier 0/no-AI per the prompt). Workload is never stored: it's always
// computed live from tasks.estimate at read time (see app/api/capacity/
// route.ts), so it can never drift from the actual assignments.
export const sprintCapacities = pgTable(
  "sprint_capacities",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sprintId: uuid("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    capacity: integer("capacity").notNull(),
  },
  (table) => [
    pgPolicy("sprint_capacities_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    primaryKey({ columns: [table.sprintId, table.userId] }),
  ],
).enableRLS();

// Machine-auth credentials for the read-only finance export
// (app/api/v1/finance/projects/route.ts) — external accounting/ERP tools
// have no Supabase user session, so they can't use the Bearer-JWT path
// every other route uses. Only `keyHash` (sha256 of the raw key) is ever
// stored; the raw key is shown once at creation and never persisted.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("api_keys_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Client portals (FR-4.x, Prompt 3.1) ---

// One row = one client's access to one project, identified by a bearer
// token in the portal URL rather than a Supabase Auth account — client
// contacts aren't org members and shouldn't need one just to view a
// project. If a client needs multiple projects they get multiple grants
// (multiple links); no separate "client identity" table, kept deliberately
// simple. Same "machine auth via a hashed secret, not a user JWT" shape as
// api_keys (Prompt 3.2) — see lib/api/portalAccess.ts.
export const clientPortalAccess = pgTable(
  "client_portal_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // Field-level visibility (task 1: "configurable visibility per
    // field") — an array of field names hidden from this client. Only
    // "budget" is a real switch today (the one field Prompt 3.2 actually
    // added); the column is jsonb/array-shaped, not a single boolean, so
    // hiding more fields later is a UI/read-path change, not a migration.
    hiddenFields: jsonb("hidden_fields").notNull().default(["budget"]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("client_portal_access_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- SSO/SAML configuration (Prompt 3.3) ---

export const ssoProviderEnum = pgEnum("sso_provider", ["saml"]);

// One row per org (unique orgId). Storing IdP metadata even though the
// login flow itself can't go live yet — see the "requires Supabase Team
// plan" note on `enabled` below — so an admin's setup work isn't lost and
// the moment the plan is upgraded, wiring the flow is a small change, not
// a data-model change too.
export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: ssoProviderEnum("provider").notNull().default("saml"),
    idpEntityId: text("idp_entity_id"),
    idpSsoUrl: text("idp_sso_url"),
    idpCertificate: text("idp_certificate"),
    // Always false in this codebase today — Supabase Auth's SAML SSO is a
    // Team-plan feature ($599/mo), not available on the Free/Pro tiers
    // this project runs on (CLAUDE.md §2: no paid infra without a flagged
    // phase-gate decision). The config UI writes everything above but
    // refuses to set this true; flip it only after confirming the
    // Supabase project has actually been upgraded, then wire the real
    // Supabase `auth.sso` provider registration on top of this row.
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("sso_configurations_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Employee Directory & Onboarding (Prompt 5.1, CLAUDE.md §11a) ---

export const employmentStatusEnum = pgEnum("employment_status", ["active", "onboarding", "terminated"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", ["not_started", "in_progress", "complete"]);

// user_id is nullable and unreferenced (no FK, same as org_memberships.
// userId — Neon has no local `auth.users` table to reference) because not
// every employee has app login; a record for someone who never gets a
// Centr8 OS account is still valid.
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    managerId: uuid("manager_id"),
    employmentStatus: employmentStatusEnum("employment_status").notNull().default("onboarding"),
    startDate: date("start_date"),
    endDate: date("end_date"),
  },
  () => [
    pgPolicy("employees_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// One workflow per employee. `steps` is a jsonb checklist
// ({label, done}[]) rather than its own child table — onboarding steps
// are always viewed/edited as one whole list, never queried individually,
// so a normalized table would only add joins with no real benefit.
export const onboardingWorkflows = pgTable(
  "onboarding_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    steps: jsonb("steps").notNull().default([]),
    status: onboardingStatusEnum("status").notNull().default("not_started"),
  },
  () => [
    pgPolicy("onboarding_workflows_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Attendance, Time Tracking & Leave Management (Prompt 5.2) ---

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "half_day", "remote"]);
export const leaveRequestStatusEnum = pgEnum("leave_request_status", ["pending", "approved", "rejected"]);

// One row per employee per day, created by self-check-in (lib/api/attendance.ts
// enforces the caller can only ever write their own employees.userId row —
// there's no admin "record attendance for someone else" path, same
// self-scoping as leave_requests below).
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    status: attendanceStatusEnum("status").notNull().default("present"),
  },
  () => [
    pgPolicy("attendance_records_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Org-level policy definitions (e.g. "PTO", 15 days/year). accrualRule is
// jsonb rather than a fixed set of columns — accrual schemes (annual grant,
// monthly accrual, tenure-based) vary enough that a rigid schema would
// need a migration per new scheme; today's balance math (lib/api/leave.ts)
// only reads daysPerYear and treats accrualRule as opaque/display-only
// until a real accrual engine is needed.
export const leavePolicies = pgTable(
  "leave_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    daysPerYear: integer("days_per_year").notNull(),
    accrualRule: jsonb("accrual_rule").notNull().default({}),
  },
  () => [
    pgPolicy("leave_policies_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => leavePolicies.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: leaveRequestStatusEnum("status").notNull().default("pending"),
    approvedBy: uuid("approved_by"),
  },
  () => [
    pgPolicy("leave_requests_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();
