-- Same reasoning as 0002/0004/0007_force_rls*.sql.

alter table "project_health_snapshots" force row level security;
