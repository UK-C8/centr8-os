# PHASE_PROMPTS.md — Centr8 OS (UI-First Order)

Sequential, paste-ready prompts for Claude Code. Follow CLAUDE.md for stack and constraints.

**Order changed from the original plan:** UI/structure is built and approved first using mock data, with zero database or auth wiring. Once the UI is locked, backend phases (schema, RLS, real API wiring, AI agents) follow and connect into the already-built screens. Nothing from earlier backend work (Neon schema, RLS) is discarded — it just gets wired in later instead of first.

---

## PHASE 0 — UI Foundation (Mock Data Only, No Backend)

No Neon, no Supabase, no real API calls in this phase. Everything runs off a local mock data file so the full app can be reviewed and approved purely on structure and design before any backend decision matters.

### Prompt 0.1 — Project Scaffold (Frontend Only)

```
Set up a fresh Next.js (App Router, TypeScript) project for Centr8 OS. This phase is UI-only — do not connect to any database, auth provider, or external API.

Tasks:
1. Initialize the Next.js project with Tailwind CSS.
2. Set up the app directory structure with route groups for: dashboard, projects, sprints, tasks, executive (dashboard rollup), portal (client-facing, placeholder for now).
3. Create a mockData.ts file with realistic fake data: 2-3 organizations, a handful of projects, milestones, sprints, and 15-20 tasks with varied statuses/priorities/assignees. This stands in for the database until Phase 1 wiring.
4. Set up a basic layout shell: sidebar navigation, top bar, main content area.
5. No auth yet — assume a single logged-in mock user for now.

Read CLAUDE.md's design/stack conventions before starting. Reference /mnt/skills/public/frontend-design/SKILL.md for visual direction — avoid a generic templated look.
```

### Prompt 0.2 — Project List & Project Detail Screens

```
Build the project list and project detail views using mockData.ts from Prompt 0.1. No backend calls.

Tasks:
1. Project list page: cards or table view of all projects for the current mock org, showing name, status, milestone count, health indicator (just a static/mock value for now).
2. Project detail page: shows the project's milestones, sprints, and task count. Include a tab or section structure for Overview / Sprints / Tasks / Settings.
3. Make status and priority visually distinct (color-coded badges).
4. Fully responsive — this should look intentional on mobile and desktop both.

Still no real data source — everything reads from mockData.ts.
```

### Prompt 0.3 — Sprint Board & Task Board

```
Build the sprint board (kanban-style) and task list views, still using mockData.ts.

Tasks:
1. Sprint board: columns by task status (To Do / In Progress / In Review / Done), tasks as draggable cards (drag can be visual-only for now, doesn't need to persist anywhere yet).
2. Task detail view/modal: title, description, assignee, priority, estimate, dependencies (just list them, no interactive graph needed yet).
3. Task list/table view as an alternative to the board (filterable by status, assignee, priority — filtering can run client-side against mockData.ts).

This is the core "feel" of the product — spend real design effort here, this is what you'll be evaluating first.
```

### Prompt 0.4 — Main Dashboard & Executive Dashboard

```
Build the two dashboard surfaces using mockData.ts, with the AI-related pieces shown as clearly mocked/placeholder content (they'll become real in a later phase).

Tasks:
1. Main dashboard: overview of active projects, task counts by status, recent activity feed (mock entries).
2. Executive dashboard: portfolio rollup across all mock projects, a "health" summary per project (use a static mock health score/summary here — this becomes AI-generated later), and a "recommended actions" list styled clearly as AI-suggested content (label it, even though it's hardcoded for now).
3. Use a distinct visual treatment for anything meant to eventually be AI-generated (a subtle badge or border style) so the distinction is baked into the design from the start, not bolted on later.

No backend, no AI calls yet — just get the shape and hierarchy right.
```

### Prompt 0.5 — AI Draft Review Screen (Mock)

```
Build the "AI project draft" review screen that will later be wired to real AI output (Phase 2+), using a hardcoded mock draft object for now.

Tasks:
1. A screen showing a mock AI-generated project draft: goal, project, milestones, sprints, tasks, all editable fields.
2. A clear "AI-generated — review before accepting" banner (this pattern gets reused everywhere AI output appears later, so get the visual treatment right here first).
3. Accept / Reject / Edit actions — for now, "Accept" just logs to console or shows a toast, no actual write anywhere.

This locks in the visual pattern for every future AI-approval screen (sprint plan proposals, generated docs, etc.) before any of them are wired to real AI.
```

### Prompt 0.6 — Design Review Checkpoint

```
Do not write new code in this step. Instead:

1. Summarize every screen built so far (0.1-0.5) with a short description of what's real vs. mock.
2. List any inconsistencies in spacing, color usage, or component patterns across the screens built so far.
3. Propose a small shared component library (Button, Badge, Card, Modal, etc.) if one hasn't emerged naturally, and refactor existing screens to use it.

This is a checkpoint before backend wiring starts — flag anything that would be expensive to change later once real data is flowing through these screens.
```

---

## PHASE 1 — Backend Foundation (Wire Real Data Into Existing UI)

From here on, the goal is to make the screens built in Phase 0 real — swapping mockData.ts for actual database calls — not to build new screens.

### Prompt 1.1 — Database & Auth Setup

```
Set up the real backend infrastructure to wire into the existing UI from Phase 0.

Stack: Neon Postgres as the database, Drizzle ORM for schema/migrations. For auth, use [Supabase Auth if reusing an existing project / Auth.js + Neon if standing up a fresh auth layer — confirm which before proceeding].

Tasks:
1. Set up Neon Postgres connection using the direct (non-pooled) connection string for migrations and pooled connection string for runtime queries. Store both in .env.local as NEON_DIRECT_URL and NEON_POOLED_URL.
2. Set up Drizzle ORM with a migrations folder.
3. Wire up auth per the decision above.
4. Create a basic health-check API route at /api/health.
5. Do not touch the existing UI components yet — this step is infra only.
```

### Prompt 1.2 — Multi-Tenant Core Schema

```
Implement the multi-tenant core data model in Neon Postgres via migrations.

Tables needed (FR-1.x, Organizations/Workspaces & Access):
- organizations (id, name, slug, branding_config jsonb, created_at)
- org_memberships (user_id, org_id, role, department_id nullable, team_id nullable)
- departments (id, org_id, parent_department_id nullable, name)
- teams (id, org_id, department_id nullable, name)
- audit_log (id, org_id, actor_user_id nullable, actor_type ['human'|'ai'], action, target_type, target_id, metadata jsonb, created_at)

Requirements:
- Every table scoped by org_id, RLS enabled and enforced.
- Use native Postgres enum types created only via the schema/migration tool, not manual CREATE TYPE.
- Write a seed script matching the shape of mockData.ts from Phase 0, so the existing UI has real equivalent data to render against once wired.

Acceptance criteria: RLS isolation test passes (User A in Org A gets zero rows from Org B).
```

### Prompt 1.3 — Work Hierarchy Schema + Wire Into Existing UI

```
Implement the work hierarchy data model (FR-2.x): Goals → Portfolios → Projects → Milestones → Sprints → Tasks, with dependencies and templates.

Tables:
- goals, portfolios, projects, milestones, sprints, tasks, task_dependencies, templates — all org_id-scoped with RLS.

Then, replace mockData.ts calls in the Phase 0 screens (project list, project detail, sprint board, task board) with real API calls to this schema. The UI components themselves should need minimal changes — only the data source swaps from mockData.ts to real fetches.

Acceptance criteria: the exact screens built in Phase 0 now render real data from Neon, and creating/editing a task in the UI persists to the database.
```

### Prompt 1.4 — RBAC Enforcement Layer

```
Implement role-based permission enforcement at org/department/team/project level (FR-1.3), with support for custom roles.

Build:
1. A permissions table defining role → allowed actions per resource type.
2. A requirePermission() helper used in every API route that mutates data.
3. Apply it to all routes built in Prompt 1.3.
4. Update the UI to hide/disable actions a user's role doesn't permit (buttons already exist from Phase 0 — just gate them).
```

---

## PHASE 2 — Autonomous PM Core (Wire Real AI Into Existing Screens)

The dashboard, executive dashboard, and AI draft review screen already exist from Phase 0 — this phase makes their content real instead of mocked.

### Prompt 2.1 — Agent Orchestration Worker (Railway)

```
Set up the first Railway worker service for AI agent orchestration.

Tasks:
1. Poll a Postgres-backed job queue (SELECT ... FOR UPDATE SKIP LOCKED) for agent tasks.
2. Scaffold five agent modules: Planner, Monitor, Analyst, Writer, Communicator.
3. Each agent call logs its autonomy tier, input, output, and org_id to audit_log.

No UI changes in this step — plumbing only.
```

### Prompt 2.2 — Wire Real AI Draft Generation Into the Phase 0.5 Screen

```
Connect the AI project draft review screen built in Phase 0.5 to real AI output.

Tasks:
1. Build /api/ai/create-project-draft, calling Google Gemini (free tier) to generate a structured draft from a free-text prompt.
2. Swap the hardcoded mock draft object in the Phase 0.5 screen for this real API response — the screen's layout and banner treatment should not need to change, only the data source.
3. Wire the "Accept" action to actually write the accepted structure into the Phase 1.3 tables (it was console-only in Phase 0).
4. Log audit_log entries for draft generation and acceptance.

Acceptance criteria: no project/task/sprint row is ever created without an explicit human "Accept" click, verified by testing a Reject path leaves the database untouched.
```

### Prompt 2.3 — Real Health Monitoring Into the Dashboard

```
Replace the mock health scores in the Phase 0.4 dashboard and executive dashboard with real AI-generated ones.

Tasks:
1. Build a health-signal computation function (overdue tasks, sprint burn rate, blocked-task count) per project.
2. Feed signals to Gemini for a plain-language health summary.
3. Store in project_health_snapshots (org_id, project_id, signals jsonb, ai_summary text, created_at).
4. Swap the static mock health score/summary in the existing dashboard UI for this real data — same visual treatment, real content.
```

### Prompt 2.4 — Autonomous Sprint Planning (Tier 1)

```
Implement the Planner agent's autonomous sprint planning (FR-9.x), reusing the AI-approval visual pattern established in Phase 0.5.

Tasks:
1. Build a job that generates a sprint plan proposal from backlog/capacity/dependencies via the Planner agent.
2. Store in sprint_plan_proposals (status pending/approved/rejected).
3. Build the review UI using the same accept/reject pattern as the Phase 0.5 draft screen for visual consistency.
4. Only on approval does it write into sprints/tasks.
```

### Prompt 2.5 — Workspace Memory & RAG Q&A

```
Implement workspace memory and RAG Q&A (FR-11.x) using Postgres + pgvector.

Tasks:
1. Enable pgvector on Neon.
2. Build ingestion pipeline embedding docs/tasks/decisions into workspace_memory, strictly org_id-partitioned.
3. Build /api/ai/ask with retrieval scoped to org, answers cited back to source records.
4. Add a simple chat UI surface (new screen, following Phase 0's component patterns) for asking questions.

Acceptance criteria: zero cross-tenant leakage, verified with a test query.
```

### Prompt 2.6 — Generative Documentation Engine

```
Implement the Writer agent's generative documentation (FR-10.x).

Tasks:
1. Build /api/ai/generate-doc for PRDs, meeting summaries, release notes, etc.
2. Render via react-pdf.
3. Store in generated_documents, default status 'draft', using the same AI-generated visual banner pattern from Phase 0.5.

Acceptance criteria: at least 3 doc types generate correctly as downloadable PDFs, all starting in draft state.
```

### Prompt 2.7 — Real Executive Recommendations

```
Replace the mocked "recommended actions" list in the Phase 0.4 executive dashboard with real Analyst-agent output.

Tasks:
1. Use the Analyst agent to generate ranked recommended actions from live project_health_snapshots and sprint_plan_proposals data.
2. Swap the static mock list for this real data — same visual treatment established in Phase 0.

Read-only for this phase — no direct action execution from the dashboard yet.
```

---

## PHASE 3 — Enterprise & Ecosystem

### Prompt 3.1 — Client Portals

```
Implement branded client portals (FR-4.x), building on the placeholder portal route scaffolded in Phase 0.1.

Tasks:
1. client_portal_access table controlling visibility per project/field.
2. Build out the /portal/[org_slug] route using organizations.branding_config.
3. Client-visible AI update summaries via Writer/Communicator agents, filtered of internal fields.
4. Client-approval action type (Tier 1) for milestones.

Acceptance criteria: client-portal user sees only designated projects, cannot see internal-only fields, approvals log to audit_log.
```

### Prompt 3.2 — Resource Planning & Budgeting

```
Implement resource planning and budgeting (FR-3.x).

Tasks:
1. Capacity tracking per team/user.
2. Project budget tracking (allocated vs. spent).
3. Over-allocation flags via Monitor agent (Tier 0 suggestion).
4. Read-only finance API export endpoint under /api/v1/.

Acceptance criteria: over-capacity assignment surfaces a visible flag without blocking.
```

### Prompt 3.3 — SSO/SAML/SCIM & Security Hardening

```
Implement SSO/SAML/SCIM using free-tier-compatible options for the auth provider chosen in Phase 1.1.

Tasks:
1. Wire SAML SSO login per org.
2. SCIM provisioning endpoints, org-scoped.
3. Verify TLS/encryption defaults.
4. Document a SOC 2 Type II readiness checklist.

Flag explicitly if any provider requires a paid tier — bring it back for a phase-gate decision, do not silently upgrade.
```

### Prompt 3.4 — Automation Builder & Plugin Architecture

```
Implement the no-code automation builder and plugin runtime (FR-6.x remainder).

Tasks:
1. automation_rules (trigger → conditions → actions), Postgres LISTEN/NOTIFY event bus.
2. NL automation-rule authoring via Planner agent (Tier 1 approval).
3. Minimal plugin runtime interface, documented contract.

Acceptance criteria: a plain-language automation request produces a working rule after approval, fires correctly.
```

### Prompt 3.5 — Voice Assistant Interface

```
Implement the voice interface (FR-12.x) using LiveKit Cloud free tier.

Tasks:
1. Wire LiveKit for voice sessions.
2. Route voice input through Gemini, dispatch to the appropriate agent.
3. Voice-triggered actions follow the same autonomy-tier rules as text.
4. AI activity log view covering both voice and chat actions.

Acceptance criteria: a Tier 1 action issued by voice still requires approval.
```

---

## PHASE 3.6 — Sidebar Restructure (Do This First, Before Any New Pillar)

### Prompt 3.6 — Restructure Sidebar for Multi-Pillar Navigation

```
Restructure the app's sidebar to the locked navigation structure in CLAUDE.md §11a, grouping existing and future items under titled sections with sub-items:

PROJECT MANAGEMENT — Dashboard, Projects, Sprints, Tasks
HR MANAGEMENT — Employee Directory, Onboarding, Attendance & Time Tracking, Leave Management, Payroll & Compensation, Performance Reviews & OKRs, Recruitment / Hiring, HR Cases & Helpdesk, Learning & Training (LMS), Employee Engagement / Surveys
COMMUNICATION — Messenger, Mail, Calls, Video Conferencing
CRM — Leads, Contacts, Accounts, Deals / Pipeline, Activities, Sales Forecasts, Campaigns
RESOURCES — Capacity Planning, Budgets
AI ASSISTANT — AI Draft, Health Monitoring, Sprint Plans, Ask AI, Documents, Recommendations
INSIGHTS — Executive Dashboard
ADMINISTRATION — Members & Roles, SSO & Security, Automations, API Keys, Audit Log, Integrations

Tasks:
1. Add non-clickable section header labels above each group (small caps, muted color per DESIGN_SYSTEM.md's --text-caption token).
2. Existing items (Dashboard, Projects, Sprints, Tasks, Executive, AI Draft, Health) move into their correct new sections — do not duplicate or rebuild them, just reposition in the nav.
3. Items for modules not yet built (everything under HR MANAGEMENT, COMMUNICATION, CRM, and unbuilt AI Assistant items like Sprint Plans/Ask AI/Documents/Recommendations) should render as visible but disabled/grayed-out nav links with a small "Coming soon" tag — do not link to 404 pages.
4. Gate section visibility by role where it already makes sense (e.g. ADMINISTRATION section only visible to admin role, per existing can() pattern) — items within HR MANAGEMENT/CRM will get their own granular permission gating once those modules are actually built in later phases.

This is a navigation-only change — no new database tables, no new API routes. Confirm the existing screens (Dashboard, Projects, Sprints, Tasks, Executive, AI Draft, Health) still work correctly after being repositioned in the new structure.
```

---

## PHASE 5 — HR Management (New Pillar, Native Build)

Build natively, following the same org_id-scoped RLS and `can()` permission pattern as Project Management. Do not start this phase until Prompt 3.6 (sidebar restructure) is done.

### Prompt 5.1 — Employee Directory & Onboarding

```
Implement the Employee Directory and Onboarding modules (HR Management pillar, CLAUDE.md §11a).

Tables:
- employees (id, org_id, user_id nullable [links to org_memberships if they also have app login], full_name, job_title, department_id, team_id, manager_id nullable, employment_status ['active'|'onboarding'|'terminated'], start_date, end_date nullable)
- onboarding_workflows (id, org_id, employee_id, template_id nullable, steps jsonb, status ['not_started'|'in_progress'|'complete'])

Requirements:
- org_id-scoped RLS, same pattern as existing tables.
- Gate mutations through can() — add employee:create, employee:update, employee:terminate permission types.
- Build a directory list/detail UI following DESIGN_SYSTEM.md tokens, consistent with the existing Projects list/detail pattern.
- Onboarding: a simple checklist-style workflow per new employee, viewable/editable by HR admin role and the employee's manager.

Acceptance criteria: creating an employee record and running them through an onboarding checklist works end-to-end, correctly scoped and gated per role.
```

### Prompt 5.2 — Attendance, Time Tracking & Leave Management

```
Implement Attendance & Time Tracking and Leave Management.

Tables:
- attendance_records (id, org_id, employee_id, date, check_in, check_out, status ['present'|'absent'|'half_day'|'remote'])
- leave_policies (id, org_id, name, days_per_year, accrual_rule jsonb)
- leave_requests (id, org_id, employee_id, policy_id, start_date, end_date, status ['pending'|'approved'|'rejected'], approved_by nullable)

Requirements:
- Same RLS/can() pattern. New permission types: attendance:record, leave:request, leave:approve.
- Employees can self-check-in/out and submit leave requests; managers approve/reject (Tier 1-style human approval, no AI involved here).
- Build a simple calendar or list view for team leave visibility.

Acceptance criteria: an employee can submit a leave request, a manager can approve/reject it, and the leave balance correctly reflects approved time off.
```

### Prompt 5.3 — Payroll & Compensation

```
Implement basic Payroll & Compensation tracking — record-keeping and structure, not automated tax/statutory payroll processing (that requires region-specific compliance logic out of scope for now, flag this limitation explicitly in the UI).

Tables:
- compensation_records (id, org_id, employee_id, base_salary, currency, effective_date, bonus jsonb nullable, benefits jsonb nullable)

Requirements:
- Highly sensitive data — restrict visibility strictly to HR admin role and the employee themselves (not even their manager, unless explicitly granted). Add a compensation:view_sensitive permission type separate from general employee:view.
- Do not build tax withholding, statutory compliance calculations, or bank disbursement — this is scope-limited to structured record-keeping only. Add a visible note in the UI: "Payroll processing and tax compliance are out of scope — this module tracks compensation records only."

Acceptance criteria: compensation data is viewable only by HR admin and the employee themselves; a manager without explicit grant cannot see it, verified with a test.
```

### Prompt 5.4 — Performance Reviews, Recruitment, HR Helpdesk, LMS, Engagement

```
Implement the remaining HR Management modules: Performance Reviews & OKRs, Recruitment/Hiring, HR Cases & Helpdesk, Learning & Training, Employee Engagement/Surveys.

Tables (one set per module, all org_id-scoped RLS):
- performance_reviews (employee_id, reviewer_id, period, ratings jsonb, comments, status)
- okrs (employee_id or team_id, objective, key_results jsonb, period)
- job_postings (title, department_id, status ['draft'|'open'|'closed'], description)
- candidates (job_posting_id, name, email, stage ['applied'|'interview'|'offer'|'hired'|'rejected'])
- hr_cases (employee_id, category, description, status, assigned_to)
- training_courses (title, content jsonb, required_for_role nullable)
- training_completions (employee_id, course_id, completed_at)
- engagement_surveys (title, questions jsonb) / survey_responses (survey_id, employee_id, answers jsonb, anonymous boolean)

Requirements:
- Standard RLS/can() pattern throughout, new permission types per module as needed.
- This is a large prompt — build incrementally, confirm each module's basic CRUD works before moving to the next.
- No AI dependency in this prompt — plain CRUD and workflows only. AI-assisted job posting drafts and review summarization are separate follow-up prompts once the Gemini/Groq provider decision is finalized.

Acceptance criteria: each module has working create/list/detail screens, correctly scoped and permission-gated.
```

---

## PHASE 6 — CRM (New Pillar, Native Build)

### Prompt 6.1 — Leads, Contacts & Accounts

```
Implement the core CRM data model: Leads, Contacts, Accounts (modeled on Zoho CRM's standard modules, per CLAUDE.md §11a).

Tables:
- leads (id, org_id, name, company, email, phone, source, status ['new'|'contacted'|'qualified'|'unqualified'|'converted'], owner_id)
- accounts (id, org_id, name, industry, website, owner_id)
- contacts (id, org_id, account_id nullable, name, email, phone, title, owner_id)

Requirements:
- org_id-scoped RLS. New permission types: lead:create/update, contact:create/update, account:create/update.
- A lead can be "converted" into an account + contact (+ later, a deal) — build this as an explicit action, not automatic.
- Build list/detail UI consistent with existing DESIGN_SYSTEM.md patterns.

Acceptance criteria: a lead can be created, qualified, and converted into an account/contact pair, correctly scoped and gated.
```

### Prompt 6.2 — Deals, Pipeline & Activities

```
Implement Deals/Pipeline and Activities.

Tables:
- deals (id, org_id, account_id, contact_id nullable, name, value, currency, stage ['prospecting'|'proposal'|'negotiation'|'won'|'lost'], owner_id, expected_close_date)
- activities (id, org_id, related_type ['lead'|'contact'|'account'|'deal'], related_id, type ['call'|'meeting'|'task'|'note'], notes, due_date nullable, completed boolean)

Requirements:
- Same RLS/can() pattern. New permission types: deal:create/update, activity:create/update.
- Build a kanban-style pipeline view for deals by stage, reusing the SprintBoard drag-and-drop component pattern from the PM pillar if practical, rather than building a new one from scratch.
- Activities attach to any CRM entity (lead/contact/account/deal) as a simple timeline.

Acceptance criteria: a deal can be dragged across pipeline stages, persisting via API; an activity logged against a deal shows correctly in its timeline.
```

### Prompt 6.3 — Sales Forecasts & Campaigns

```
Implement Sales Forecasts and Campaigns.

Tables:
- forecasts (id, org_id, period, target_value, computed from deals in that period's expected_close_date and stage)
- campaigns (id, org_id, name, type, status, start_date, end_date, linked_leads jsonb or a join table)

Requirements:
- Forecasts are a computed rollup view (no AI needed) — total pipeline value by stage/period, not a prediction. (AI-based forecasting is a Phase 4 knowledge-graph-era feature per the original roadmap, not this prompt.)
- Campaigns track which leads came from which campaign for basic ROI visibility.
- Same RLS/can() pattern throughout.

Acceptance criteria: the forecast view correctly sums deal values by stage and period; a campaign shows the leads attributed to it.
```

---

## PHASE 7 — Communication (Integrated, Not Native)

### Prompt 7.1 — Integration/Connector Framework

```
Build the integration/connector framework that the Communication pillar (Messenger, Mail, Calls, Video Conferencing) will plug into — per CLAUDE.md §11a, these are integrated via connectors, not rebuilt natively.

Tasks:
1. An integrations table (org_id, provider ['slack'|'gmail'|'zoom'|etc.], config jsonb, connected_by, connected_at, status).
2. A simple OAuth connection flow for at least one provider end-to-end (pick the most valuable first — likely Gmail or Slack) to prove the pattern before adding more.
3. An Integrations screen under ADMINISTRATION where an org admin can connect/disconnect providers.
4. Surface connected communication tools contextually where relevant (e.g. a "Send via Slack" button on a client update, a "Send via Gmail" option on a generated document) rather than building a full native inbox/chat UI.

Requirements:
- Do not attempt to rebuild Slack/Gmail/Zoom's actual interfaces — this phase is about connecting to them via API/OAuth, surfacing minimal relevant actions inside Centr8 OS, not replicating their UIs.
- Standard RLS/can() pattern for the integrations table itself (org:configure_integrations permission).

Acceptance criteria: an org admin can connect at least one real provider via OAuth, and a message/email can be sent through it from within Centr8 OS as a proof of concept.
```

---

## PHASE 4 — Scale & Differentiation

### Prompt 4.1 — Knowledge Graph Maturity

```
Extend workspace memory into a knowledge graph.

Tasks:
1. Entity/relationship tables on top of workspace_memory.
2. Update RAG Q&A to traverse relationships, not just similarity search.
3. Maintain strict org_id partitioning.

Acceptance criteria: precedent queries surface linked decisions across related entities, correctly scoped per org.
```

### Prompt 4.2 — Custom AI Agents & Multi-Agent Orchestration

```
Allow orgs to define custom agent behaviors on top of the five base agents.

Tasks:
1. custom_agent_configs table for per-org prompt/parameter adjustment within guardrails.
2. Multi-agent handoff chains in the orchestration worker, respecting individual autonomy tiers.
3. Portfolio-level forecasting via the Analyst agent.

Do not begin this phase without confirming Phase 3 acceptance criteria are complete with Urvil first.
```
