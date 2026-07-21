-- Same reasoning as 0002_force_rls.sql: the Neon role running migrations
-- owns these tables and would otherwise bypass their RLS policies.

alter table "goals" force row level security;
alter table "portfolios" force row level security;
alter table "projects" force row level security;
alter table "milestones" force row level security;
alter table "sprints" force row level security;
alter table "tasks" force row level security;
alter table "task_dependencies" force row level security;
alter table "templates" force row level security;
