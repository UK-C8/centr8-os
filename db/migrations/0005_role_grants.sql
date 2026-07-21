-- RLS policies only filter *which* rows a statement can see/touch — the
-- underlying GRANT-based privilege to run that statement at all is a
-- separate check, and creating authenticated/service_role in 0000 never
-- granted either one anything. Without this, every query from those roles
-- fails with "permission denied" before RLS is even evaluated.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- Applies the same grants automatically to tables created later by this
-- migration role, so future `drizzle-kit generate` migrations don't need
-- a matching grants migration of their own.
alter default privileges for role current_user in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
