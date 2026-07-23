-- 'attendance'/'leave' (resource_type) and 'record'/'request' (permission_
-- action) were added in 0029 — separate migration for the same reason as
-- every prior enum-value + seed pair (0009/0010, ..., 0026/0028): Postgres
-- won't let a new enum value be used in the same transaction that adds it.
--
--   attendance:record — owner/admin/member (everyone who'd have their own
--                        employee record punches their own in/out; viewer
--                        stays read-only across this app, so excluded).
--   leave:request      — same breadth as attendance:record — submitting
--                        your own leave request is a day-to-day action,
--                        not an admin one.
--   leave:approve      — owner/admin only in the grid. A manager who isn't
--                        also owner/admin approves via the direct
--                        employees.managerId check in application code
--                        (lib/api/employees.ts's requireEmployeeManageAccess,
--                        reused here), not a role grant — "manager" isn't
--                        a role.
--   leave:configure     — leave_policies CRUD, owner/admin only, same
--                        tightness as sso/portal:configure.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'attendance'::resource_type, 'record'::permission_action
from unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'leave'::resource_type, a.action
from unnest(array['request']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'leave'::resource_type, a.action
from unnest(array['approve', 'configure']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
