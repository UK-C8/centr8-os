-- 'compensation' (resource_type) and 'view_sensitive' (permission_action)
-- were added in 0032 — separate migration for the same reason as every
-- prior enum-value + seed pair (0009/0010, ..., 0029/0031): Postgres won't
-- let a new enum value be used in the same transaction that adds it.
--
-- Deliberately owner/admin only, ALL actions (create/update/delete/
-- view_sensitive) — no member/viewer default at all, unlike every other
-- resource type this app has (which at minimum get a blanket 'read').
-- This is the one resource type where "no grant" is the correct default:
-- an employee's own-record access (self-view) is checked directly in
-- application code (requireSelfEmployee, lib/api/employees.ts), not
-- through this table — per the prompt, "not even their manager, unless
-- explicitly granted," so there is no default manager path either.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'compensation'::resource_type, a.action
from unnest(array['create', 'update', 'delete', 'view_sensitive']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
