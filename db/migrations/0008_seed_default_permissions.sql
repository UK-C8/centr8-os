-- Default (org_id null) permission matrix for the four built-in roles.
-- requirePermission() (lib/api/permissions.ts) checks these as a fallback
-- whenever an org hasn't defined its own override/custom-role rows.
--
--   owner  — full CRUD on everything, including deleting the org itself.
--   admin  — full CRUD on everything except deleting the organization.
--   member — read-only on org structure (org/department/team/project/
--            milestone/sprint); full CRUD on the things they actually do
--            day to day (tasks, task dependencies).
--   viewer — read-only on everything.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, rt.resource_type, a.action
from unnest(enum_range(null::resource_type)) as rt(resource_type)
cross join unnest(enum_range(null::permission_action)) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)
where not (r.role = 'admin' and rt.resource_type = 'organization' and a.action = 'delete')

union all

select null, 'member', rt.resource_type, 'read'
from unnest(enum_range(null::resource_type)) as rt(resource_type)

union all

select null, 'member', rt.resource_type, a.action
from unnest(array['task', 'task_dependency']::resource_type[]) as rt(resource_type)
cross join unnest(array['create', 'update', 'delete']::permission_action[]) as a(action)

union all

select null, 'viewer', rt.resource_type, 'read'
from unnest(enum_range(null::resource_type)) as rt(resource_type);
