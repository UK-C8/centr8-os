-- Same reasoning as 0002/0004/0007/0012/0015/0017/0020/0023/0027_force_rls*.sql.

alter table "attendance_records" force row level security;
alter table "leave_policies" force row level security;
alter table "leave_requests" force row level security;
