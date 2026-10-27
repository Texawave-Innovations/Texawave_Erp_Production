-- Same reasoning and explicit request as
-- 20261026160000_drop_employee_status_history_append_only: hard-deleting an
-- employee needs to be able to remove their own leave request history too.
-- This drops leave_requests' append-only protection against DELETE for
-- every leave request, not only ones belonging to a deleted employee.
-- leave_requests_protect (blocks UPDATE of a decided/submitted request) is
-- untouched and still enforced.

DROP TRIGGER IF EXISTS "leave_requests_no_delete" ON "hr"."leave_requests";
