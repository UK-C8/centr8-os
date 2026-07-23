# CLAUDE.md — Centr8 OS

Locked architecture and requirement reference for Claude Code. Read this before starting any phase. Do not deviate from the stack or patterns below without flagging it back to Urvil first.

---

## 1. Product Summary

Centr8 OS is an AI-native "operating system for work." An autonomous AI Project Manager plans, monitors, and executes operational project work. Humans set direction and approve consequential AI actions via a tiered autonomy model. Source docs: Centr8 OS BRD v1.0, Centr8 OS PRD v1.0, Centr8 OS Feature Tracker (July 2026).

---

## 2. Locked Tech Stack (Free Tier Only)

| Layer | Tool | Notes |
|---|---|---|
| Frontend / API routes | Next.js (Vercel) | Standard CRUD, auth pages, dashboards, client portal |
| AI / Agent orchestration workers | Node or Python long-running workers (Railway) | Agents don't fit serverless timeouts — planning/monitoring loops run here |
| Database | Neon Postgres | Single source of truth for both Next.js and Railway workers |
| Auth / RBAC | Supabase Auth (free tier) | RLS for multi-tenant isolation |
| Job queue | Postgres-backed (`SELECT ... FOR UPDATE SKIP LOCKED`) | Do NOT use Upstash — already consumed by SiteScore |
| LLM | Google Gemini (free tier) | All agent reasoning (Planner, Monitor, Analyst, Writer, Communicator) |
| RAG / embeddings | Postgres + pgvector (Neon extension, free) | No external vector DB |
| Email / transactional | Resend | Client comms, notifications |
| Analytics | PostHog | Feature usage, AI action logs |
| PDF / doc generation | react-pdf (client-side) | Generative docs (PRDs, SOPs, reports) render client-side |
| Realtime / notifications | Postgres LISTEN/NOTIFY or polling | No paid realtime service |

**Hard constraint:** No paid infra (Temporal, ClickHouse, dedicated vector DB, paid Redis) unless explicitly revisited at a phase gate, same pattern as Recur8.

---

## 3. Multi-Tenant & Data Isolation

- Every table scoped by `org_id`. RLS policies enforced at Postgres level via Supabase Auth, not just app-layer checks.
- AI context/memory (workspace memory, RAG index) is partitioned by `org_id` — no cross-tenant leakage, including in embeddings/vector search.
- Use direct (non-pooled) Neon connection string for all migrations; pooled connection for runtime queries only.

---

## 4. AI Autonomy Tiers (Governance Model — PRD Section 5)

| Tier | Behavior | Example |
|---|---|---|
| Tier 0 — Suggest Only | AI proposes, human must trigger | Draft client comms |
| Tier 1 — Approve to Act | AI queues, human approves/rejects in a window | Sprint plan activation, reassignment |
| Tier 2 — Act with Notification | AI executes low-risk reversible actions, notifies after | Status updates, standup posts |
| Tier 3 — Full Autonomy (opt-in, scoped) | AI executes without per-instance approval, within policy | Recurring task generation, routine reports |

**Default for every new AI action type: Tier 0.** Escalating to Tier 1+ requires an explicit config flag per org, per action type. Never default an action higher than Tier 0 without Urvil confirming it in the phase review.

---

## 5. Composable Agent Pattern

Do not build one monolithic "do everything" AI call. Five specialized agents, each a distinct prompt/service, coordinated by a lightweight orchestration layer (a Railway worker, not a separate paid orchestration product):

- **Planner** — NL → structured project/sprint plans
- **Monitor** — health signals, risk detection, delivery prediction
- **Analyst** — comparative analysis, executive insights
- **Writer** — generative docs (PRDs, SOPs, release notes, reports)
- **Communicator** — client updates, standup summaries

---

## 6. Requirement ID Convention

Requirements referenced as `FR-x.x` (functional), matching the Feature Tracker. 63 total FRs across 13 categories. Priority: 46 Must, 16 Should, 1 Could. Full detail lives in `Centr8_OS_Feature_Tracker.xlsx` — this file summarizes scope only; the tracker is the source of truth for status/owner.

Category → ID prefix mapping:

| Category | Prefix range (approx) |
|---|---|
| Organizations, Workspaces & Access | FR-1.x |
| Work Hierarchy (Goals→Tasks) | FR-2.x |
| Resource Planning & Budgeting | FR-3.x |
| Client Portals | FR-4.x |
| Documentation & Knowledge Mgmt | FR-5.x |
| Automation, API, Webhooks, Integrations | FR-6.x |
| AI: NL Project Creation | FR-7.x |
| AI: Monitoring, Prediction, Risk | FR-8.x |
| AI: Sprint Planning & Workflow Automation | FR-9.x |
| AI: Generative Docs & Comms | FR-10.x |
| AI: Workspace Memory & RAG Q&A | FR-11.x |
| AI Assistant Interfaces | FR-12.x |
| Executive Insight & Decision Support | FR-13.x |

(Verify exact IDs against the tracker before implementing — this table is a navigation aid, not the authoritative list.)

---

## 7. Acceptance Criteria Pattern

Every feature implemented must satisfy, at minimum:
1. Scoped correctly to `org_id` (no cross-tenant data visible)
2. If it's an AI action: correct autonomy tier enforced, and an audit log entry written
3. If it's AI-generated content: a "provisional/AI-generated" banner shown until a human confirms/accepts it (same UX pattern as LucidCarat)
4. No paid service introduced without a flagged deviation

---

## 8. Out of Scope (V1) — Do Not Build

- Native time-tracking hardware
- Payroll / full HRIS
- Full accounting/ERP (integration only, not a rebuild)
- On-prem / air-gapped deployment
- Native mobile apps

---

## 9. Open Questions (Not Yet Decided — Flag if Blocking)

- Final AI usage-based pricing model (per-seat + consumption vs. tiered flat)
- Which LLM provider/routing strategy long-term (currently Gemini free tier for build phase only — production model choice is unresolved)
- Whether native mobile gets pulled into Release 2
- Minimum viable native integrations for early design partners
- Data residency requirements for first regulated customer

---

## 10. Reusable Cross-Project Patterns (Carry Forward)

- Provisional-results banner (LucidCarat) — applies to all AI-generated output here, not just docs
- Postgres-backed job queue (RAG Scanner) — reused directly for agent task queueing
- Separate-repo admin panel pattern (ExportInvoice Pro precedent) — `centr8os-admin` as its own repo if/when an internal admin console is needed
- react-pdf async/sync boundary (ExportInvoice Pro) — applies to generative doc export (PRDs, SOPs, release notes)

---

## 11a. Scope Expansion — HR, CRM, and Communication Pillars (Added Post-V1)

Centr8 OS's scope has expanded beyond the original BRD/PRD's "AI-native project management" positioning. The product is now a multi-pillar business OS with five pillars:

1. **Project Management** (original scope — Goals→Portfolios→Projects→Milestones→Sprints→Tasks)
2. **HR Management** (new — modeled on Zoho People's feature set)
3. **CRM** (new — modeled on Zoho CRM's standard modules)
4. **Communication** (new — Messenger, Mail, Calls, Video Conferencing)
5. **AI Assistant** (cuts across all four pillars above, not a separate product)

This is a deliberate, confirmed scope change from the original BRD (which listed HR/payroll and full CRM as out-of-scope integrations-only). Anyone picking up this codebase later should treat this section as authoritative over the original BRD Section 4.2 where they conflict.

### Build vs. Integrate Decision

- **HR Management** and **CRM**: build natively, following the same schema/RLS/RBAC patterns already established for the Project Management pillar (org_id-scoped tables, `can()` permission gating, DESIGN_SYSTEM.md tokens).
- **Communication** (Messenger, Mail, Calls, Video Conferencing): integrate via connectors/plugins, do NOT rebuild natively. These are individually massive products (Slack, Gmail, Zoom-scale) and rebuilding them natively is out of scope even long-term. Use the plugin/integration architecture from Prompt 3.4 as the mechanism — Centr8 OS surfaces these tools inside its UI via connectors, it does not replace them.

### Sidebar / Navigation Structure (Locked)

```
PROJECT MANAGEMENT
  Dashboard, Projects, Sprints, Tasks

HR MANAGEMENT
  Employee Directory, Onboarding, Attendance & Time Tracking,
  Leave Management, Payroll & Compensation, Performance Reviews & OKRs,
  Recruitment / Hiring, HR Cases & Helpdesk, Learning & Training (LMS),
  Employee Engagement / Surveys

COMMUNICATION (integrated, not native)
  Messenger, Mail, Calls, Video Conferencing

CRM
  Leads, Contacts, Accounts, Deals / Pipeline, Activities,
  Sales Forecasts, Campaigns

RESOURCES
  Capacity Planning, Budgets

AI ASSISTANT (dedicated cross-module screens)
  AI Draft, Health Monitoring, Sprint Plans, Ask AI, Documents, Recommendations

INSIGHTS
  Executive Dashboard

ADMINISTRATION
  Members & Roles, SSO & Security, Automations, API Keys, Audit Log, Integrations
```

### AI Placement Rule

AI is not siloed to the AI Assistant section alone. The five composable agents (Planner, Monitor, Analyst, Writer, Communicator — CLAUDE.md §5) are reusable across all pillars:

- **HR Management**: AI-drafted job postings (Writer), AI-summarized performance reviews (Analyst), AI-flagged attendance anomalies (Monitor)
- **CRM**: AI lead scoring (Analyst), AI-drafted follow-up emails (Writer), AI-generated deal-risk summaries (Monitor)
- **Project Management**: already implemented (Health Monitoring, AI Draft)

Every contextual AI touchpoint inside a module (not a dedicated AI Assistant screen) must still follow the provisional-results banner pattern and correct autonomy tier per CLAUDE.md §4 — embedding AI into more modules does not relax the approval-gating rules.

### Current Status (flag for future sessions)

As of this scope expansion, CRM and Communication pillars are **planning-stage only — no schema, no API routes, no UI built yet**. HR Management has three real slices: Employee Directory + Onboarding (Prompt 5.1) — `employees`/`onboarding_workflows` tables, `employee:{create,read,update,delete,terminate}` permissions, `/hr/directory` list/detail UI; and Attendance/Time Tracking + Leave Management (Prompt 5.2) — `attendance_records`/`leave_policies`/`leave_requests` tables, `attendance:record`/`leave:{request,approve,configure}` permissions, self-service check-in/out and leave requests with manager/HR-admin approval and a computed (not stored) leave balance, `/hr/attendance` + `/hr/leave` UI. The rest of HR Management's sidebar items (Payroll, Performance Reviews, Recruitment, HR Cases, Learning, Engagement) remain unbuilt. Treat any reference to a specific HR/CRM/Communication feature as unbuilt until confirmed otherwise in a status check, same discipline applied to the original PM-only phases.

## 11. Phase Gate Rule

Do not start a phase until the prior phase's acceptance criteria pass. Confirm completion with Urvil before moving forward. If a paid-tier substitution becomes unavoidable, flag it explicitly rather than silently switching — same rule as Recur8's Phase 3 gate with Chintan.
