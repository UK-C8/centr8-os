-- 'performance'/'recruitment'/'hr_case'/'training'/'engagement' (resource_
-- type) were added in 0037 — separate migration for the same reason as
-- every prior enum-value + seed pair (0009/0010, ..., 0032/0034):
-- Postgres won't let a new enum value be used in the same transaction
-- that adds it.
--
-- Owner/admin only, full CRUD (create/read/update/delete) on all five —
-- same HR-admin-only-data-entry default as attendance/leave/compensation
-- (Prompts 5.2/5.3), no member/viewer grant at all. Each module covers
-- two tables (performance_reviews+okrs, job_postings+candidates,
-- training_courses+training_completions, engagement_surveys+
-- survey_responses) under one resource_type — see db/schema.ts's comment
-- above the resource_type enum for why.

insert into permissions (org_id, role, resource_type, action)
select null::uuid, r.role, rt.resource_type, a.action
from unnest(array['performance', 'recruitment', 'hr_case', 'training', 'engagement']::resource_type[]) as rt(resource_type)
cross join unnest(array['create', 'read', 'update', 'delete']::permission_action[]) as a(action)
cross join unnest(array['owner', 'admin']) as r(role);
