-- Same reasoning as 0002/0004/0007/0012/0015/0017/0020/0023_force_rls*.sql.

alter table "employees" force row level security;
alter table "onboarding_workflows" force row level security;
