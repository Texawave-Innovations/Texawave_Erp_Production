-- Cleanup of test data left in the DEV database (texawave_erp) by an e2e run on 2026-09-30.
-- NOT EXECUTED. Awaiting approval of this exact file.
--
-- Hard constraints honoured:
--   * audit_logs is never touched: no DELETE/UPDATE on it, its triggers are NOT disabled,
--     session_replication_role is NOT changed. All 7 rows are preserved.
--   * Because audit_logs references organizations 2,3 and users 2,5 (ON DELETE RESTRICT),
--     those four rows CANNOT be deleted while the audit rows exist. They are DEACTIVATED and
--     soft-deleted instead (login blocked, hidden from queries that filter deleted_at).
--   * Only rows that are provably the test data are touched: every statement pins id + slug/email/code.
--
-- Run as a single transaction. Any failed assertion aborts everything (nothing is changed).
BEGIN;

DO $$
DECLARE n int;
BEGIN
  -- Preconditions: the data is exactly what the impact report describes.
  SELECT count(*) INTO n FROM organizations
   WHERE (id, slug) IN ((2,'audit-a-2e4f9c7f'), (3,'audit-b-2e4f9c7f'));
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 test organizations, found %', n; END IF;

  SELECT count(*) INTO n FROM users
   WHERE (id, organization_id, email) IN
     ((2,2,'writerA@audit-a-2e4f9c7f.test'), (3,2,'readerA@audit-a-2e4f9c7f.test'),
      (4,2,'nobodyA@audit-a-2e4f9c7f.test'), (5,3,'writerB@audit-b-2e4f9c7f.test'));
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 test users, found %', n; END IF;

  SELECT count(*) INTO n FROM permissions WHERE id = 30 AND code = 'testaudit.probe.write';
  IF n <> 1 THEN RAISE EXCEPTION 'expected the test permission, found %', n; END IF;

  SELECT count(*) INTO n FROM audit_logs;
  IF n <> 7 THEN RAISE EXCEPTION 'expected 7 audit rows, found %', n; END IF;

  -- Nothing else may hang off the rows we will delete.
  SELECT count(*) INTO n FROM user_roles WHERE user_id IN (3,4);
  IF n <> 0 THEN RAISE EXCEPTION 'users 3,4 still have % role assignments', n; END IF;
  SELECT count(*) INTO n FROM role_permissions WHERE permission_id = 30;
  IF n <> 0 THEN RAISE EXCEPTION 'permission 30 is still granted to % role(s)', n; END IF;
  SELECT count(*) INTO n FROM audit_logs WHERE actor_user_id IN (3,4);
  IF n <> 0 THEN RAISE EXCEPTION 'users 3,4 are referenced by % audit rows', n; END IF;
END $$;

-- 1. Delete what can be deleted without touching audit history.
DELETE FROM users       WHERE id IN (3,4) AND organization_id = 2
                          AND email IN ('readerA@audit-a-2e4f9c7f.test','nobodyA@audit-a-2e4f9c7f.test');
DELETE FROM permissions WHERE id = 30 AND code = 'testaudit.probe.write';

-- 2. Deactivate + soft-delete what audit rows still reference (cannot be deleted).
UPDATE users SET is_active = false, deleted_at = now(), updated_at = now()
 WHERE id IN (2,5) AND email IN ('writerA@audit-a-2e4f9c7f.test','writerB@audit-b-2e4f9c7f.test');
UPDATE organizations SET is_active = false, deleted_at = now(), updated_at = now()
 WHERE id IN (2,3) AND slug IN ('audit-a-2e4f9c7f','audit-b-2e4f9c7f');

-- 3. Postconditions.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM audit_logs;
  IF n <> 7 THEN RAISE EXCEPTION 'audit rows changed: %', n; END IF;
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal AND tgenabled <> 'O';
  IF n <> 0 THEN RAISE EXCEPTION 'an audit trigger is not enabled'; END IF;
  SELECT count(*) INTO n FROM users WHERE organization_id = 1 AND is_active AND deleted_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'the real org/user was affected'; END IF;
END $$;

COMMIT;

-- ROLLBACK OF THE SOFT-DELETE (only if ever needed; deleted rows 3,4 and permission 30 are test data and not restored):
--   UPDATE users SET is_active=true, deleted_at=NULL WHERE id IN (2,5);
--   UPDATE organizations SET is_active=true, deleted_at=NULL WHERE id IN (2,3);
