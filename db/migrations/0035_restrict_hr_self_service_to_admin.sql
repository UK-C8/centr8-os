-- Scope change confirmed by Urvil: HR Management (Attendance, Leave,
-- Compensation) is HR-admin data-entry only — employees do not get
-- self-service logins for these actions. Reverses the 'member' grants
-- 0031_seed_attendance_leave_permissions.sql added for attendance:record
-- and leave:request; owner/admin keep them (now used to record/request on
-- an employee's behalf, not their own). compensation:view_sensitive was
-- already owner/admin-only — the self-view path this migration's app-code
-- counterpart removes was an application-layer fallback, not a grant row,
-- so there's nothing to delete here for compensation.

delete from permissions
where resource_type = 'attendance' and action = 'record' and role = 'member'
   or resource_type = 'leave' and action = 'request' and role = 'member';
