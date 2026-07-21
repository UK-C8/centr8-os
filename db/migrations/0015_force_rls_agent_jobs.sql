-- Same reasoning as 0002/0004/0007/0012_force_rls*.sql.

alter table "agent_jobs" force row level security;
