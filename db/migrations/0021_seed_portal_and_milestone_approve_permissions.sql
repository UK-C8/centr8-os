-- 'approve' and 'configure' (permission_action) and 'portal' (resource_type)
-- were all added in 0019 — separate migration for the same reason as
-- 0009/0010, 0011/0013, 0016/0018 (Postgres won't let a new enum value be
-- used in the same transaction that adds it).
--
-- Note 0008's blanket "owner/admin get every resource_type/action" seed
-- only iterated the enum values that existed when it ran — 'approve' and
-- 'portal' didn't exist yet, so owner/admin need this explicit grant the
-- same way every resource type added since 0009 has.
--
--   portal   — configure (create/update/revoke a client's access grant)
--              is owner/admin only, same tightness as api_key (Prompt
--              3.2): it controls what an external party can see. read
--              (viewing the grant list) extends to member too.
--   approve  — milestone approval extends to member, same day-to-day-PM
--              reasoning as member's task/task_dependency CRUD grant.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'portal'::resource_type, 'configure'::permission_action
from unnest(array['owner', 'admin']) as r(role)

union all

select null::uuid, r.role, 'portal'::resource_type, 'read'::permission_action
from unnest(array['owner', 'admin', 'member']) as r(role)

union all

select null::uuid, r.role, 'milestone'::resource_type, 'approve'::permission_action
from unnest(array['owner', 'admin', 'member']) as r(role);
