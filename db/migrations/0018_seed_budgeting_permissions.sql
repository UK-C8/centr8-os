-- Default (org_id null) permission matrix for the three FR-3.x resource
-- types added in 0016 — same two-migrations-apart reasoning as 0009/0010
-- and 0011/0013 (Postgres won't let a new enum value be used in the same
-- transaction that adds it).
--
--   budget   — only "update" is meaningful (budget fields live on the
--              `projects` row itself, no separate record to create/delete;
--              viewing rides along on ordinary project reads, no separate
--              "read" check anywhere). owner/admin only, same scope as
--              project:update.
--   capacity — real rows in sprint_capacities. owner/admin/member get full
--              CRUD, same breadth as task/task_dependency ("the things
--              they actually do day to day"); viewer read-only.
--   api_key  — exports budget data to external tools, so kept tighter than
--              ordinary org-structure resources: owner/admin only, no
--              grant at all for member/viewer. No "update" action — a key
--              is either live (create) or revoked (delete), never edited.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'budget'::resource_type, 'update'::permission_action
from unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'capacity'::resource_type, a.action
from unnest(array['create', 'read', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, 'viewer', 'capacity'::resource_type, 'read'::permission_action

union all

select null::uuid, r.role, 'api_key'::resource_type, a.action
from unnest(array['create', 'read', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
