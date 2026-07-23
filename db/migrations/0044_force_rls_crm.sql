-- Same reasoning as 0002/0004/.../0038/0041_force_rls*.sql.

alter table "accounts" force row level security;
alter table "contacts" force row level security;
alter table "leads" force row level security;
