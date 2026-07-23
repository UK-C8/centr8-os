-- 'holiday' (resource_type) was added in 0040 — separate migration for the
-- same reason as every prior enum-value + seed pair (0009/0010, ...,
-- 0037/0039): Postgres won't let a new enum value be used in the same
-- transaction that adds it.
--
-- Owner/admin only, full CRUD — same HR-admin-only-data-entry default as
-- the rest of HR Management (no member/viewer grant).

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'holiday'::resource_type, a.action
from unnest(array['create', 'read', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
