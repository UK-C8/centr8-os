-- ENABLE ROW LEVEL SECURITY (already set per-table in 0001) is not enough on
-- its own: Postgres exempts the table owner from RLS by default, and the
-- single Neon role this project uses for migrations is that owner. FORCE
-- makes policies apply to the owner too, so the seed/test scripts below
-- exercise the same isolation the app gets at runtime.

alter table "organizations" force row level security;
alter table "departments" force row level security;
alter table "teams" force row level security;
alter table "org_memberships" force row level security;
alter table "audit_log" force row level security;
