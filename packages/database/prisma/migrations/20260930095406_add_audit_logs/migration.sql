-- Audit platform: append-only audit trail (reports/AUDIT_PLATFORM_DESIGN.md).
-- The table and indexes below are Prisma-generated; the CHECK constraints and
-- triggers at the end are raw SQL because Prisma cannot express them.

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "actor_user_id" INTEGER,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "entity_type" TEXT NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" VARCHAR(64),
    "correlation_id" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_history_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id", "id" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("organization_id", "actor_user_id", "id" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("organization_id", "at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- RESTRICT (not SET NULL): SET NULL would UPDATE an audit row, which the
-- append-only trigger below forbids. Users are soft-deleted anyway.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw SQL (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- A user actor must be identified; only a system actor (jobs, migrations) may
-- have no user id. Anything else is a bug in the writer.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_type_check"
  CHECK ("actor_type" IN ('user', 'system'));
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_present_check"
  CHECK ("actor_type" = 'system' OR "actor_user_id" IS NOT NULL);

-- Append-only, enforced by the database rather than by convention: any UPDATE,
-- DELETE or TRUNCATE is rejected. Reusable for other append-only tables (the
-- employee status history uses it too). This stops application bugs; a
-- superuser can still drop the trigger (see the design document's limitations).
CREATE FUNCTION "prevent_row_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_row_mutation"();
