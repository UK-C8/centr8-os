-- 'sso' (resource_type) was added in 0022 — separate migration for the
-- same reason as every prior enum-value + seed pair (0009/0010,
-- 0011/0013, 0016/0018, 0019/0021): Postgres won't let a new enum value
-- be used in the same transaction that adds it.
--
-- owner/admin only, same tightness as api_key/portal:configure — SSO
-- config controls how every user in the org authenticates.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, 'sso'::resource_type, a.action
from unnest(array['configure', 'read']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
