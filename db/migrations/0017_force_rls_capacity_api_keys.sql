-- Same reasoning as 0002/0004/0007/0012/0015_force_rls*.sql.

alter table "sprint_capacities" force row level security;
alter table "api_keys" force row level security;
