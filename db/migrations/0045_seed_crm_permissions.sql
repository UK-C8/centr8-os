-- 'lead'/'contact'/'account' (resource_type) were added in 0043 —
-- separate migration for the same reason as every prior enum-value + seed
-- pair (0009/0010, ..., 0040/0042): Postgres won't let a new enum value be
-- used in the same transaction that adds it.
--
-- Unlike HR Management, CRM data is a shared sales-team working set, not
-- admin-restricted: owner/admin/member all get full CRUD (same "things
-- people do day to day" tier as task/task_dependency in
-- 0008_seed_default_permissions.sql), viewer stays read-only.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, rt.resource_type, a.action
from unnest(array['lead', 'contact', 'account']::resource_type[]) as rt(resource_type)
cross join unnest(array['create', 'read', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, 'viewer', rt.resource_type, 'read'::permission_action
from unnest(array['lead', 'contact', 'account']::resource_type[]) as rt(resource_type);
