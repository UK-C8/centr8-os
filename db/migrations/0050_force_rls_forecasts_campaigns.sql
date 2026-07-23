-- Same reasoning as 0002/0004/.../0047_force_rls*.sql.

alter table "campaigns" force row level security;
alter table "forecasts" force row level security;
