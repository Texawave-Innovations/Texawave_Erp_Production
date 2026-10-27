-- Explicit, requested reversal of the append-only guarantee on
-- employee_status_history (added in 20260930101132_add_hr_employees),
-- so a permanent hard delete of an employee (and their status history)
-- is possible. This removes a real audit-integrity protection for this
-- table going forward, including for every future employee, not only the
-- ones deleted at the time this migration ran. The shared
-- `prevent_row_mutation` function (packages/database/prisma/migrations/
-- 20260930095406_add_audit_logs/migration.sql) is left in place and still
-- protects audit_logs and any other table still wired to it.

DROP TRIGGER IF EXISTS "employee_status_history_no_update_delete" ON "hr"."employee_status_history";
DROP TRIGGER IF EXISTS "employee_status_history_no_truncate" ON "hr"."employee_status_history";
