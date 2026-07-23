-- 'deal'/'activity' (resource_type) were added in 0046 — separate
-- migration for the same reason as every prior enum-value + seed pair
-- (0009/0010, ..., 0043/0045): Postgres won't let a new enum value be used
-- in the same transaction that adds it.
--
-- Same "shared sales-team working set" tier as lead/contact/account
-- (0045): owner/admin/member all get full CRUD, viewer stays read-only.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, rt.resource_type, a.action
from unnest(array['deal', 'activity']::resource_type[]) as rt(resource_type)
cross join unnest(array['create', 'read', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, 'viewer', rt.resource_type, 'read'::permission_action
from unnest(array['deal', 'activity']::resource_type[]) as rt(resource_type);
