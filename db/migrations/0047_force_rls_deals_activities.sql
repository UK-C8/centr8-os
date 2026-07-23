-- Same reasoning as 0002/0004/.../0044_force_rls*.sql.

alter table "deals" force row level security;
alter table "activities" force row level security;
