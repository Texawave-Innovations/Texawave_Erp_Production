-- Work logs module removed: the feature, its permissions and menu items are gone.
-- This drops every stored work log; there is no archive.
DROP TABLE "hr"."work_logs";

-- The menu catalogue no longer lists these items and menu sync never removes
-- rows, so switch them off here.
UPDATE "platform"."menu_items"
SET "is_active" = false, "deleted_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('hr-work-logs', 'portal-work-logs') AND "deleted_at" IS NULL;
