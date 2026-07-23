-- 'employee' (resource_type) and 'terminate' (permission_action) were
-- added in 0026 — separate migration for the same reason as every prior
-- enum-value + seed pair (0009/0010, 0011/0013, 0016/0018, 0019/0021,
-- 0022/0025): Postgres won't let a new enum value be used in the same
-- transaction that adds it.
--
--   owner/admin — full CRUD + terminate (directory management, same
--                  breadth as project/task).
--   member      — read-only, same as the "read-only on org structure"
--                  default every other org-structure resource type gets.
--   viewer      — read-only.
--
-- Onboarding workflow access is NOT modeled here — it's gated by
-- employee:update (HR admin) OR a direct manager check against
-- employees.managerId in application code (lib/api/employees.ts), not a
-- role-permission-grid entry, since "the employee's manager" isn't a role.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'employee'::resource_type, a.action
from unnest(array['create', 'read', 'update', 'delete', 'terminate']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, 'member', 'employee'::resource_type, 'read'::permission_action

union all

select null::uuid, 'viewer', 'employee'::resource_type, 'read'::permission_action;
