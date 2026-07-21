-- 'goal' was added to the resource_type enum in 0009 — Postgres won't let a
-- new enum value be used in the same transaction that adds it, hence the
-- separate migration. Same "org structure" tier as project/milestone/sprint:
-- owner/admin get full CRUD, member/viewer are read-only.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'goal'::resource_type, a.action
from unnest(enum_range(null::permission_action)) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, 'member', 'goal'::resource_type, 'read'::permission_action

union all

select null::uuid, 'viewer', 'goal'::resource_type, 'read'::permission_action;
