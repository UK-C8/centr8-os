# PHASE_PROMPTS.md — Centr8 OS

Sequential, paste-ready prompts for Claude Code. Follow CLAUDE.md for stack and constraints. Do not skip a phase before its acceptance criteria pass.

---

## PHASE 1 — Foundation (0–4 months scope, build-order adapted)

### Prompt 1.1 — Repo & Project Scaffold

```
Set up the Centr8 OS repo from scratch.

Stack: Next.js (App Router) on Vercel for frontend + API routes, Neon Postgres as the database, Supabase Auth for authentication and RLS, Railway reserved for a separate future worker service (do not build the worker yet).

Tasks:
1. Initialize a Next.js TypeScript project.
2. Set up Neon Postgres connection using the direct (non-pooled) connection string for migrations and pooled connection string for runtime queries. Store both in .env.local as NEON_DIRECT_URL and NEON_POOLED_URL.
3. Set up Drizzle ORM (or Prisma if you judge it simpler for this schema) with a migrations folder.
4. Set up Supabase Auth for email/password + SSO placeholder (SSO wiring comes in Phase 3, just scaffold the config).
5. Create a basic health-check API route at /api/health.
6. Create a README with setup steps.

Do not add any paid service. Confirm the stack choices match CLAUDE.md before proceeding.
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
- Every table scoped by org_id.
- Enable Postgres RLS on every tenant-scoped table; write policies so a user can only read/write rows where org_id matches their org_memberships.
- Use sa.Enum / native Postgres enum types for role and actor_type — do NOT manually CREATE TYPE outside the migration's create_table step, let the ORM/migration tool handle type creation to avoid DuplicateObject errors.
- Write a seed script with one test org, one admin user, one department, one team.

Acceptance criteria: a query as User A in Org 1 must return zero rows from Org 2's data, verified with a test script.
```

### Prompt 1.3 — Work Hierarchy Schema

```
Implement the work hierarchy data model (FR-2.x): Goals → Portfolios → Projects → Milestones → Sprints → Tasks, with dependencies, templates, and workflows.

Tables:
- goals (id, org_id, title, description, owner_id)
- portfolios (id, org_id, goal_id nullable, name)
- projects (id, org_id, portfolio_id nullable, name, status, start_date, end_date)
- milestones (id, org_id, project_id, name, due_date)
- sprints (id, org_id, project_id, name, start_date, end_date, status)
- tasks (id, org_id, project_id, sprint_id nullable, title, description, status, priority, assignee_id nullable, estimate)
- task_dependencies (task_id, depends_on_task_id, type ['blocks'|'blocked_by'])
- templates (id, org_id nullable for global templates, name, structure jsonb)

All tables org_id-scoped with RLS, same pattern as Prompt 1.2. Build basic CRUD API routes under /api/projects, /api/sprints, /api/tasks. Include a simple task-dependency cycle check (reject a dependency that would create a circular reference).

Acceptance criteria: can create a project → milestone → sprint → task chain via API, and dependency cycle attempts are rejected with a clear error.
```

### Prompt 1.4 — RBAC Enforcement Layer

```
Implement role-based permission enforcement at org/department/team/project level (FR-1.3), with support for custom roles.

Build:
1. A permissions table defining role → allowed actions per resource type.
2. A middleware/helper (e.g. requirePermission(userId, orgId, action, resourceType)) used in every API route that mutates data.
3. Apply it to all routes built in Prompt 1.3.
4. Write tests confirming a non-admin role is blocked from actions like deleting a project.

Keep this simple and table-driven — do not hardcode role checks per-route.
```

### Prompt 1.5 — Baseline AI: NL Project Creation (Suggest Only, Tier 0)

```
Implement the first AI feature: natural-language project creation (FR-7.x), Tier 0 — Suggest Only per CLAUDE.md's autonomy model.

Tasks:
1. Build an API route /api/ai/create-project-draft that takes a free-text prompt, calls Google Gemini (free tier), and returns a structured JSON draft: { goal, project, milestones[], sprints[], tasks[] }.
2. Do NOT write anything to the database automatically. The draft is returned to the frontend for human review.
3. Build a simple review UI showing the draft with editable fields.
4. Add an explicit "Accept & Create" button that, only on human click, writes the accepted structure into the Phase 1.3 tables.
5. Every AI-generated draft must show a visible "AI-generated — review before accepting" banner (provisional-results pattern from LucidCarat).
6. Log an audit_log entry when a draft is generated and another when a human accepts it.

Acceptance criteria: no project/task/sprint row is ever created without an explicit human "Accept" action.
```

### Prompt 1.6 — Baseline AI Health Monitoring (Read-Only)

```
Implement baseline AI health monitoring (FR-8.x subset) as a read-only signal, no autonomous action yet.

Tasks:
1. Build a scheduled or on-demand function that scans open tasks/sprints per project and computes simple health signals (overdue tasks, sprint burn rate, blocked-task count).
2. Feed these signals plus project context to Gemini to generate a plain-language health summary per project.
3. Store results in a project_health_snapshots table (org_id, project_id, signals jsonb, ai_summary text, created_at).
4. Build a simple dashboard route showing the latest snapshot per project.

This is Tier 0 — informational only, nothing here triggers any write to project/task data.
```

### Prompt 1.7 — Core Public API Baseline

```
Expose a baseline public REST API (FR-6.x groundwork) for organizations, projects, and tasks built so far.

Tasks:
1. Version the API under /api/v1/.
2. Add API key-based auth for external callers (separate from the Supabase session auth used by the web app), scoped per org_id.
3. Document endpoints in a simple OpenAPI/Swagger file or markdown reference.
4. Rate-limit using a simple Postgres-backed counter (no paid rate-limiting service).

Acceptance criteria: an external API key can list/create/read projects and tasks for its own org only, verified with a test script using two different org API keys.
```

---

## PHASE 2 — Autonomous PM Core (4–8 months scope)

### Prompt 2.1 — Agent Orchestration Worker (Railway)

```
Set up the first Railway worker service for AI agent orchestration, separate from the Next.js app.

Tasks:
1. Create a new service (Node or Python — pick based on your existing Railway worker conventions) that polls a Postgres-backed job queue (SELECT ... FOR UPDATE SKIP LOCKED pattern from RAG Scanner) for agent tasks.
2. Scaffold five agent modules as distinct callable units: Planner, Monitor, Analyst, Writer, Communicator — each its own function/service, not one shared prompt.
3. Each agent call must log its autonomy tier, input, output, and org_id to audit_log.
4. Do not implement full logic yet for all five — just the plumbing: job pickup, dispatch to the right agent, result storage, error handling/retry.

Acceptance criteria: a test job enqueued for each of the five agent types is picked up, dispatched, and its result stored, verified end to end.
```

### Prompt 2.2 — Predictive Risk Detection & Delivery Prediction

```
Implement the Monitor agent's predictive risk detection and delivery-date prediction (FR-8.x).

Tasks:
1. Extend project_health_snapshots (Prompt 1.6) with a predicted_delivery_date and risk_level field.
2. Use historical sprint velocity + current burn rate + blocked-task signals as inputs to the Monitor agent (Gemini) to generate the prediction and a plain-language explanation of why.
3. Surface blockers explicitly: list which tasks/dependencies are driving the risk.
4. This remains Tier 0/1 — predictions are informational; any suggested corrective action (e.g. reassign task) is queued as a Tier 1 proposal requiring approval, not auto-applied.

Acceptance criteria: a project with overdue blocking tasks produces a visibly different risk_level and predicted_delivery_date than a healthy project, with a human-readable explanation.
```

### Prompt 2.3 — Autonomous Sprint Planning (Tier 1 — Approve to Act)

```
Implement the Planner agent's autonomous sprint planning (FR-9.x), Tier 1.

Tasks:
1. Build a job type "generate_sprint_plan" that takes a project_id, pulls backlog tasks, team capacity, and dependencies, and asks the Planner agent (Gemini) to propose a sprint plan (task list, assignees, estimated capacity fit).
2. Store the proposal in a sprint_plan_proposals table (org_id, project_id, proposed_plan jsonb, status ['pending'|'approved'|'rejected'], created_at, decided_by, decided_at).
3. Build a review UI listing pending proposals with accept/reject actions.
4. Only on explicit approval does the system write the plan into actual sprints/tasks (Phase 1.3 tables) and update task assignments.
5. Rejected proposals are logged with a reason field (optional human note).

Acceptance criteria: no sprint plan is ever activated without a human decision recorded in sprint_plan_proposals.
```

### Prompt 2.4 — Workspace Memory & RAG Q&A

```
Implement workspace memory and RAG-based Q&A (FR-11.x) using Postgres + pgvector, no external vector DB.

Tasks:
1. Enable the pgvector extension on Neon.
2. Build an ingestion pipeline that embeds project docs, task descriptions, and past AI decisions (from audit_log) into a workspace_memory table (org_id, source_type, source_id, content, embedding vector).
3. Ensure embeddings are strictly partitioned per org_id — no cross-tenant retrieval, verified with a test query from Org 1 that must never surface Org 2 content.
4. Build an /api/ai/ask endpoint: takes a question + org_id, retrieves top-k relevant chunks via cosine similarity scoped to that org, and asks Gemini to answer with citations back to source records.
5. Every answer must show which source records it drew from (precedent surfacing, per PRD FR-11.x).

Acceptance criteria: cross-tenant leakage test passes (zero leakage), and answers include traceable citations.
```

### Prompt 2.5 — Generative Documentation Engine

```
Implement the Writer agent's generative documentation (FR-10.x): PRDs, SOPs, meeting summaries, release notes, bug reports, test cases, client updates, executive summaries.

Tasks:
1. Build a generic /api/ai/generate-doc endpoint that takes doc_type, org_id, project_id, and relevant context, and calls the Writer agent to produce a structured doc.
2. Render generated docs client-side using react-pdf, following the async/sync boundary pattern from ExportInvoice Pro.
3. Store generated docs in a generated_documents table with a status field ['draft'|'reviewed'|'finalized'].
4. All generated docs default to 'draft' with the provisional-results banner until a human marks them reviewed/finalized.

Acceptance criteria: at least PRD, meeting summary, and release note doc types generate correctly and render as downloadable PDFs, all starting in draft state.
```

### Prompt 2.6 — Executive Dashboard

```
Implement the executive dashboard (FR-13.x subset) surfacing portfolio health, delivery forecasts, and ranked recommended actions.

Tasks:
1. Build a dashboard route aggregating project_health_snapshots and sprint_plan_proposals across all projects in an org.
2. Use the Analyst agent to generate a ranked list of recommended actions (e.g. "Project X is at risk, review sprint plan proposal") with plain-language reasoning.
3. This is read-only/informational — no direct action execution from this dashboard in Phase 2.

Acceptance criteria: an executive-role user sees a single-page rollup of all active projects' health and top 3-5 recommended actions org-wide.
```

---

## PHASE 3 — Enterprise & Ecosystem (8–12 months scope)

### Prompt 3.1 — Client Portals

```
Implement branded client portals (FR-4.x).

Tasks:
1. Build a client_portal_access table controlling which external users can view which projects, with configurable visibility per field (e.g. hide budget from clients).
2. Build a separate portal route (e.g. /portal/[org_slug]) using the branding_config from organizations for logo/theme.
3. Client-visible AI update summaries: reuse the Writer/Communicator agents to generate a client-safe summary (filtered of internal-only fields) on a schedule or on-demand.
4. Add a client-approval action type (Tier 1) for milestones requiring external sign-off.

Acceptance criteria: a client-portal user sees only their org's designated projects, cannot see internal-only fields, and can approve a milestone which logs to audit_log.
```

### Prompt 3.2 — Resource Planning & Budgeting

```
Implement resource planning and budgeting (FR-3.x).

Tasks:
1. Build capacity tracking per team/user (hours or story points per sprint).
2. Build project budget tracking (allocated vs. spent, simple manual entry plus optional finance API hook).
3. Add over-allocation flags: Monitor agent checks capacity vs. assigned work and raises a Tier 0 suggestion when someone is over-allocated.
4. Build a finance API endpoint under /api/v1/ for external accounting/ERP integration (read-only budget data export — full ERP integration is out of scope per BRD).

Acceptance criteria: assigning a task that pushes a user over capacity surfaces a visible flag without blocking the assignment.
```

### Prompt 3.3 — SSO/SAML/SCIM & Security Hardening

```
Implement SSO/SAML/SCIM (NFR: Security) using Supabase Auth's SSO support (free/lowest-tier options) or a documented free-tier-compatible SAML provider.

Tasks:
1. Wire SAML SSO login flow per org (configurable in org settings).
2. Implement SCIM provisioning endpoints for user lifecycle sync, scoped per org.
3. Confirm TLS/encryption defaults are enforced (Vercel/Neon defaults should already satisfy this — verify, don't rebuild).
4. Document what's needed for SOC 2 Type II readiness as a checklist (this phase documents/prepares, does not certify).

Flag explicitly if any SSO/SCIM provider requires a paid tier — do not silently upgrade; bring it back for a phase-gate decision.
```

### Prompt 3.4 — Automation Builder & Plugin Architecture

```
Implement the no-code automation builder and plugin runtime (FR-6.x remainder).

Tasks:
1. Build a simple trigger → condition → action automation model (e.g. "when task status = Done, then post update to client portal"), stored as automation_rules (org_id, trigger, conditions jsonb, actions jsonb, enabled).
2. Build an event bus using Postgres LISTEN/NOTIFY (no paid event service) that fires on core state changes (task status change, sprint completion, etc.) and checks matching automation_rules.
3. Add NL automation-rule authoring: a Planner-agent-assisted flow where a user describes a rule in plain language and the AI proposes the structured rule for approval (Tier 1).
4. Scaffold a minimal plugin runtime interface (even if only 1-2 real plugins exist initially) — document the plugin contract clearly for future extension.

Acceptance criteria: a plain-language automation request produces a working rule after human approval, and it fires correctly on the matching event.
```

### Prompt 3.5 — Voice Assistant Interface

```
Implement the voice interface for the AI Assistant (FR-12.x), reusing LiveKit Cloud free tier per Centr8 stack conventions.

Tasks:
1. Wire LiveKit Cloud for voice session handling.
2. Route voice input through Google Gemini for transcription/understanding, then dispatch to the appropriate agent (Planner/Monitor/etc.) based on intent.
3. All voice-triggered actions follow the same autonomy-tier rules as their text-based equivalents — voice is just another input surface, not a bypass.
4. Add an AI activity log view so users can see everything the assistant did or proposed, voice or chat.

Acceptance criteria: a voice command that would normally require Tier 1 approval still requires approval when issued by voice.
```

---

## PHASE 4 — Scale & Differentiation (12+ months scope)

### Prompt 4.1 — Knowledge Graph Maturity

```
Extend workspace memory (Phase 2.4) into a proper knowledge graph.

Tasks:
1. Add entity/relationship tables on top of workspace_memory (e.g. decision → affected_project, person → expertise_area) derived from ingested content.
2. Update the RAG Q&A endpoint to traverse relationships, not just similarity search, for precedent surfacing.
3. Keep strict org_id partitioning as the non-negotiable constraint carried from Phase 2.

Acceptance criteria: a query like "what did we decide about X before" surfaces linked decisions across related entities, still scoped correctly per org.
```

### Prompt 4.2 — Custom AI Agents & Multi-Agent Orchestration

```
Allow orgs to define custom agent behaviors on top of the five base agents (Planner, Monitor, Analyst, Writer, Communicator).

Tasks:
1. Build a custom_agent_configs table letting an org admin adjust prompts/parameters per base agent within guardrails (cannot bypass autonomy tiers).
2. Extend the orchestration worker (Phase 2.1) to support multi-agent handoff chains (e.g. Monitor flags risk → Planner proposes replan → Writer drafts client update), still respecting each individual action's autonomy tier.
3. Add advanced forecasting: combine historical data across multiple projects for portfolio-level forecasting (Analyst agent).

This phase only starts once Phase 3 acceptance criteria are confirmed complete with Urvil — do not begin without that check-in.
```
