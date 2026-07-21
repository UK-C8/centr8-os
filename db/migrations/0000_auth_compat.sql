-- Neon has no built-in `auth` schema/functions the way Supabase's own
-- Postgres does. Since Supabase Auth here only issues JWTs (Neon holds the
-- data), we replicate the two helpers app code relies on:
--   auth.uid()           reads the verified user id the app sets per request
--   auth.user_org_ids()  the calling user's org memberships, SECURITY DEFINER
--                         so it can read org_memberships without recursing
--                         into that table's own RLS policy.
-- The app must run `select set_config('request.jwt.claim.sub', $userId, true)`
-- on the same connection/transaction before any RLS-scoped query.

-- Supabase's own Postgres ships `authenticated`/`anon` roles for PostgREST;
-- Neon has neither. The generated policies below are `TO authenticated`, so
-- create it as a NOLOGIN group role and grant it to whichever Neon role the
-- app actually connects as (current_user here == the role running this
-- migration via NEON_DIRECT_URL, which is also the role NEON_POOLED_URL
-- connects as on a standard single-role Neon project).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant authenticated to current_user;

-- Forcing RLS (0002) also binds the migration/app role itself, which
-- creates a bootstrap problem: creating org #1 requires a membership row,
-- which requires org #1 to already exist. A BYPASSRLS role, only entered
-- via explicit `set role service_role` for the duration of an admin
-- operation (seeding, org provisioning), breaks that cycle. Plain queries
-- on the connection stay RLS-scoped unless a script opts in.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant service_role to current_user;

-- org_memberships doesn't exist until the next migration; skip Postgres's
-- eager body validation so this CREATE FUNCTION can forward-reference it.
set check_function_bodies = off;

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.user_org_ids() returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select org_id from org_memberships where user_id = auth.uid()
$$;
