# SOC 2 Type II Readiness Checklist — Centr8 OS

Prompt 3.3 deliverable. **This document prepares for a SOC 2 Type II audit — it does not certify one.** SOC 2 Type II specifically requires an auditor to observe controls operating effectively over a period of time (typically 3–12 months); nothing in a codebase snapshot can satisfy that on its own, no matter how complete. Treat this as an honest gap list to work from, not a compliance claim to make to a customer or investor as-is.

Organized by the five SOC 2 Trust Services Criteria. Each item is marked:
- ✅ **In place** — built and verifiable in this repo today
- ⚠️ **Partial** — something exists but doesn't fully cover the control
- ❌ **Missing** — not started

---

## 1. Security (the only mandatory criterion — every SOC 2 report includes it)

### Access control
- ✅ **Role-based access control** — `permissions` table (role → resource_type → action), enforced via `requirePermission()` on every mutating API route (Prompt 1.4). Verified with a real viewer-role test account across every phase since.
- ✅ **Multi-tenant row-level isolation** — every org-scoped table has Postgres RLS `FORCE ROW LEVEL SECURITY`, keyed off `auth.user_org_ids()`. RLS isolation test exists (`npm run db:test-rls`).
- ✅ **Deactivated-user access revocation** — `org_memberships.deactivated_at` (Prompt 3.3) is excluded from both `requirePermission()`'s membership lookup *and* `auth.user_org_ids()` itself, so deactivation revokes RLS-level data access, not just mutation rights.
- ✅ **SSO/SAML** — schema, permission gating (`sso:configure`/`sso:read`, owner/admin only), and IdP-metadata config UI are built. **Blocked**: Supabase Auth's SAML SSO is a Team-plan feature ($599/mo), not available on the Free/Pro tiers this project runs on. No login flow is live. See `db/schema.ts`'s `ssoConfigurations.enabled` comment.
- ❌ **Multi-factor authentication** — not implemented for any login path (password or otherwise). Supabase Auth supports MFA (TOTP); this app doesn't enable or require it.
- ❌ **Periodic access reviews** — no process (automated or manual) for an org owner to periodically review who has access and what role. `org_memberships` is fully visible/editable via the API, but nothing prompts a review.
- ⚠️ **SCIM provisioning** — build/deactivate/remove lifecycle exists (Prompt 3.3), which *helps* timely deprovisioning, but it's a practical RFC 7644 subset (no groups, no bulk ops) and untested against a real IdP (Okta/Azure AD), only against hand-built SCIM-shaped requests.

### Encryption
- ✅ **In transit** — enforced everywhere, not configurable off:
  - Neon Postgres: both connection strings require `sslmode=require&channel_binding=require`.
  - Supabase Auth/REST API: HTTPS-only by URL (`https://*.supabase.co`), no HTTP variant exists.
  - Vercel: HTTPS-only on every deployment (`*.vercel.app` and custom domains), automatic TLS certs, no way to serve plain HTTP.
- ⚠️ **At rest** — Neon and Supabase both encrypt data at rest by default (platform-level, AES-256 per their published docs), but this hasn't been independently verified against either provider's current SOC 2/compliance documentation — for an actual audit, pull Neon's and Supabase's own SOC 2 reports as subprocessor evidence rather than taking the default on faith.
- ✅ **API keys / portal tokens never stored in plaintext** — `api_keys.keyHash` and `client_portal_access.tokenHash` are sha256 hashes; the raw secret is shown exactly once at creation and never persisted (Prompts 3.1, 3.2).

### Audit logging
- ⚠️ **Partial coverage** — `audit_log` records every AI agent job (success or failure, with tier/input/output), every AI draft accept/reject, every milestone approval, and project-health scans. It does **not** log ordinary CRUD (creating a task, editing a project, changing a sprint status) — those mutations are real and permission-checked, just not written to `audit_log`. A full audit trail for SOC 2 purposes would need every state-changing action logged, not only AI/approval actions.
- ❌ **Centralized log monitoring/alerting** — `audit_log` is a plain table with no dashboard, retention policy, export, or anomaly alerting on top of it.

### Vulnerability management
- ❌ **No automated dependency scanning** — no Dependabot, Snyk, or equivalent configured on the GitHub repo.
- ❌ **No SAST/dependency audit in CI** — there is no CI pipeline at all beyond Vercel's build step; `npm audit` is not run automatically anywhere.
- ❌ **No penetration testing** — never performed.

### Change management
- ⚠️ **Informal only** — all changes go through git commits with descriptive messages and this session's own manual verification (typecheck, build, live API tests against real data) before each deploy, but there's no branch-protection rule, required PR review, or formal change-approval record. Every deploy in this project's history has gone straight to `main` → Vercel production.

---

## 2. Availability
- ✅ **Hosting** — Vercel (app), Neon (Postgres), Supabase (Auth), Railway (agent worker) all publish their own uptime SLAs at paid tiers; this project is on free/hobby tiers for all of them, which typically carry **no uptime SLA**.
- ❌ **Backups / disaster recovery** — Neon's free tier has limited point-in-time-recovery retention (a few days). No documented or tested restore procedure exists for this project.
- ❌ **Monitoring/alerting** — no uptime monitoring, error-rate alerting, or on-call process configured for any service in the stack.
- ❌ **Incident response plan** — not written.

## 3. Processing Integrity
- ✅ **Tier-0/Tier-1 autonomy gating** — every AI-initiated write requires an explicit human "Accept" click (draft creation) or is read-only (health scans); enforced in code, not just convention (verified: the accept route's handler has no direct writes to work-hierarchy tables outside the explicit accept path).
- ⚠️ **Testing** — verification throughout this project has been live, manual, ad hoc (curl against real Neon/Supabase data, browser checks) per feature, not an automated test suite. No `npm test` exists.

## 4. Confidentiality
- ✅ **Multi-tenant isolation** — see Security §Access control above; this is the same control, doing double duty.
- ✅ **Field-level visibility control** — `client_portal_access.hiddenFields` (Prompt 3.1) lets an org hide specific fields (currently: budget) from a given external client.
- ❌ **Data classification** — no formal labeling of what data is "confidential" vs. "internal" vs. "public" beyond the client-portal hidden-fields mechanism.

## 5. Privacy
- ❌ **Privacy policy / data handling documentation** — none exists in this repo (a product-level, not code-level, gap).
- ❌ **Data retention / deletion policy** — no automated purge of old audit_log rows, revoked keys, or deactivated memberships; everything accumulates indefinitely today.
- ⚠️ **Subprocessor list** — implicitly: Vercel, Neon, Supabase, Google (Gemini), Railway. Never formally documented as a vendor/subprocessor register.

---

## Summary for an actual audit engagement

**Real, verifiable controls today:** RBAC + RLS multi-tenant isolation (the strongest area of this codebase — extensively tested across every phase), TLS enforced everywhere, secrets never stored in plaintext, Tier-0/1 AI autonomy gating, field-level client-data visibility control.

**Biggest gaps before a Type II engagement could even start the observation period:** no MFA, no automated dependency/vulnerability scanning, no CI-enforced change management, incomplete audit-log coverage (AI/approval actions only, not general CRUD), no monitoring/alerting or incident response plan, no tested backup/restore process, no formal subprocessor or data-retention documentation.

**Blocked, not missing:** SAML SSO is fully designed and ready to wire up, but requires upgrading Supabase to the Team plan ($599/mo) first — a business decision, not an engineering one.
