-- 'project_health_snapshot' was added to resource_type in 0011 — separate
-- migration for the same reason as 0010 (Postgres won't let a new enum
-- value be used in the same transaction that adds it).
--
-- Snapshots are immutable point-in-time records — no route updates or
-- deletes one, so only create/read are seeded. owner/admin/member can
-- trigger a scan (it costs a Gemini call, so viewer — who never triggers
-- side effects elsewhere in this app — can't); everyone can read.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'project_health_snapshot'::resource_type, a.action
from unnest(array['create', 'read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, 'viewer', 'project_health_snapshot'::resource_type, 'read'::permission_action;
