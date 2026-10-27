-- Same reasoning as 20261026160000 and 20261026163000: hard-deleting an
-- employee needs to be able to remove a ticket they raised, which needs to
-- be able to remove that ticket's comments (ticket_comments.ticket_id is
-- ON DELETE RESTRICT, so a ticket with comments could not be deleted even
-- after this, until the comments are deleted first). This drops
-- ticket_comments' append-only protection for every ticket comment in the
-- system, not only ones on a deleted employee's ticket.

DROP TRIGGER IF EXISTS "ticket_comments_no_update_delete" ON "hr"."ticket_comments";
DROP TRIGGER IF EXISTS "ticket_comments_no_truncate" ON "hr"."ticket_comments";
