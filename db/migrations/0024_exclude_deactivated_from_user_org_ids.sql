-- Prompt 3.3 — SCIM "deactivate a user" needs to actually revoke data
-- access, not just block requirePermission()'s mutation checks. Every RLS
-- policy in this app keys off auth.user_org_ids() (see 0000_auth_compat.sql),
-- so a deactivated membership has to disappear from *this* function's
-- result too, or a deactivated user could still read (and, on any table
-- whose policy doesn't route through requirePermission, write) everything
-- RLS alone would otherwise allow.

create or replace function auth.user_org_ids() returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select org_id from org_memberships where user_id = auth.uid() and deactivated_at is null
$$;
