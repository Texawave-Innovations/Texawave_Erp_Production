-- Platform-wide PostgreSQL schema split (Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md).
-- Hand-authored, NOT Prisma's auto-generated diff: `prisma migrate dev`'s
-- diff engine has no way to express "this table moved to a new schema" — it
-- only sees "a table named platform.organizations doesn't exist yet" and
-- "public.organizations is no longer declared," and would emit CREATE TABLE
-- for the former while silently leaving the latter (and all its data)
-- orphaned in `public`, rather than moving it. Confirmed by generating this
-- migration once with `prisma migrate dev --create-only` and inspecting the
-- output before writing this file: it contained 25 CREATE TABLE statements
-- and zero ALTER TABLE/DROP TABLE statements. That generated version was
-- never applied to any database and is replaced in full here.
--
-- This is the same reason the add_audit_logs migration's triggers are raw
-- SQL rather than Prisma schema syntax: Prisma cannot express everything
-- Postgres can, and the project's own convention (see that migration's
-- header) is to hand-write the raw SQL for what it can't, inside an
-- otherwise Prisma-generated migration file.
--
-- ALTER TABLE ... SET SCHEMA is metadata-only: no data is copied or
-- rewritten, no row is touched, and all constraints/indexes/triggers/foreign
-- keys stay attached to the table (Postgres binds them by internal object id,
-- not by schema-qualified name). Postgres moves a table's OWNED sequences
-- (SERIAL/BIGSERIAL) automatically as part of this statement — confirmed
-- empirically in this rehearsal: an explicit `ALTER SEQUENCE ... SET SCHEMA`
-- immediately after the matching `ALTER TABLE ... SET SCHEMA` failed with
-- "relation public.<x>_id_seq does not exist", because the sequence had
-- already moved with its table. No explicit sequence statements are needed
-- or included here.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "hr";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform";

-- Move platform tables (Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md §1.1) — owned
-- sequences move automatically with each table.
ALTER TABLE "public"."organizations" SET SCHEMA "platform";
ALTER TABLE "public"."users" SET SCHEMA "platform";
ALTER TABLE "public"."permissions" SET SCHEMA "platform";
ALTER TABLE "public"."roles" SET SCHEMA "platform";
ALTER TABLE "public"."role_permissions" SET SCHEMA "platform";
ALTER TABLE "public"."user_roles" SET SCHEMA "platform";
ALTER TABLE "public"."departments" SET SCHEMA "platform";
ALTER TABLE "public"."teams" SET SCHEMA "platform";
ALTER TABLE "public"."user_team_access" SET SCHEMA "platform";
ALTER TABLE "public"."password_reset_tokens" SET SCHEMA "platform";
ALTER TABLE "public"."tags" SET SCHEMA "platform";
ALTER TABLE "public"."menu_items" SET SCHEMA "platform";
ALTER TABLE "public"."audit_logs" SET SCHEMA "platform";
ALTER TABLE "public"."document_sequences" SET SCHEMA "platform";

-- Move hr tables (Docs/PLATFORM_SCHEMA_SPLIT_PLAN.md §1.3) — owned sequences
-- move automatically with each table.
ALTER TABLE "public"."designations" SET SCHEMA "hr";
ALTER TABLE "public"."employment_types" SET SCHEMA "hr";
ALTER TABLE "public"."work_locations" SET SCHEMA "hr";
ALTER TABLE "public"."employees" SET SCHEMA "hr";
ALTER TABLE "public"."employee_status_history" SET SCHEMA "hr";
ALTER TABLE "public"."shifts" SET SCHEMA "hr";
ALTER TABLE "public"."shift_assignments" SET SCHEMA "hr";
ALTER TABLE "public"."holidays" SET SCHEMA "hr";
ALTER TABLE "public"."weekly_off_rules" SET SCHEMA "hr";
ALTER TABLE "public"."leave_types" SET SCHEMA "hr";
ALTER TABLE "public"."leave_requests" SET SCHEMA "hr";

-- Move the four custom trigger functions (add_audit_logs, add_hr_employees,
-- add_hr_leave migrations) into their owning schema. ALTER TABLE ... SET
-- SCHEMA does NOT move functions — they are independent objects — so this is
-- separate from the table moves above. Existing triggers remain correctly
-- wired through this move: Postgres binds a trigger to its function by
-- internal object id, not by schema-qualified name, and ALTER FUNCTION ...
-- SET SCHEMA preserves that id.
ALTER FUNCTION "prevent_row_mutation"() SET SCHEMA "platform";
ALTER FUNCTION "employees_protect_identity"() SET SCHEMA "hr";
ALTER FUNCTION "employees_no_reporting_cycle"() SET SCHEMA "hr";
ALTER FUNCTION "leave_requests_protect"() SET SCHEMA "hr";

-- employees_no_reporting_cycle's body contains an UNQUALIFIED reference to
-- "employees" (`SELECT "reports_to_id" INTO cursor_id FROM "employees" ...`).
-- Unlike the trigger-to-function binding above, a PL/pgSQL function body
-- resolves unqualified names via the search_path in effect every time it
-- EXECUTES, not once at CREATE time — so simply moving the function's own
-- schema does not fix this; confirmed empirically in this rehearsal: with
-- only the ALTER FUNCTION above applied, inserting an employee whose
-- reports_to_id chain is more than one hop deep failed with
-- "relation employees does not exist" the moment the function's loop body
-- ran. Fixed here by replacing the body with an hr-qualified reference. CREATE
-- OR REPLACE preserves the function's object id, so the trigger stays wired
-- without needing to be recreated.
CREATE OR REPLACE FUNCTION "hr"."employees_no_reporting_cycle"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cursor_id integer := NEW."reports_to_id";
  hops integer := 0;
BEGIN
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW."id" THEN
      RAISE EXCEPTION 'reporting line cycle: employee % would (indirectly) report to themselves', NEW."id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'employees_no_reporting_cycle';
    END IF;
    hops := hops + 1;
    IF hops > 1000 THEN
      RAISE EXCEPTION 'reporting line too deep or cyclic'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'employees_no_reporting_cycle';
    END IF;
    SELECT "reports_to_id" INTO cursor_id FROM "hr"."employees" WHERE "id" = cursor_id;
  END LOOP;
  RETURN NEW;
END;
$$;
