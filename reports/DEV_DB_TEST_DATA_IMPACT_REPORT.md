# Dev database test data — read-only impact report

**Database:** `texawave_erp` (Docker Postgres, localhost:5432). Everything below was gathered with `SELECT`s. **Nothing was modified.**
**Cause:** an e2e run on 2026-09-30 11:02 reached the dev DB (guard bug, fixed — see completion report §0).

## Inventory (exactly what exists)

| Kind                             | Rows                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations                    | id 2 `audit-a-2e4f9c7f`, id 3 `audit-b-2e4f9c7f` (both active, empty)                                                                               |
| Users                            | 2 `writerA@audit-a-2e4f9c7f.test`, 3 `readerA@…`, 4 `nobodyA@…` (org 2); 5 `writerB@audit-b-2e4f9c7f.test` (org 3)                                  |
| Permission                       | id 30 `testaudit.probe.write`                                                                                                                       |
| Audit rows                       | **7 total in the whole DB** — ids 1,2,4,5,8,9 (org 2) and 10 (org 3); all `entity_type=tag`; actors: user 2 ×5, user 5 ×1, system ×1 (`auto_close`) |
| Everything else referencing them | **0**: roles, user_roles, role_permissions, teams, tags, employees, user_team_access, departments, employment_types, document_sequences             |
| Real data                        | org 1 `texawave-innovations`, user 1 `admin@texawave.com` — untouched and active                                                                    |
| Redis DB 0                       | only `refresh:1:…` (yours); no test keys remain                                                                                                     |
| Audit triggers                   | `audit_logs_no_update_delete`, `audit_logs_no_truncate` — both **enabled** (`O`)                                                                    |

## The constraint that shapes the cleanup

`audit_logs.organization_id` and `audit_logs.actor_user_id` are `ON DELETE RESTRICT`. Preserving all 7 audit rows (your requirement) therefore means:

| Row                | Can be deleted? | Why                                    |
| ------------------ | --------------- | -------------------------------------- |
| Users 3, 4         | ✅ yes          | no audit rows reference them, no roles |
| Permission 30      | ✅ yes          | not granted to any role                |
| **User 2, user 5** | ❌ no           | they are actors of audit rows          |
| **Orgs 2, 3**      | ❌ no           | audit rows belong to them              |

Deleting users 2/5 or orgs 2/3 would require deleting audit history or disabling the append-only trigger — **not done and not proposed**. They are instead **deactivated and soft-deleted** (`is_active=false`, `deleted_at=now()`): login is blocked (auth checks `is_active`), and queries that filter `deleted_at` no longer see them. Their unique slugs/emails stay reserved (harmless). Fully removing them is only possible if you ever decide to purge the audit rows themselves — a separate decision.

## Proposed cleanup — `reports/dev-db-test-data-cleanup.sql` (NOT executed)

One transaction, preceded by assertions that abort everything if reality differs from this report, followed by postconditions:

1. `DELETE` users 3, 4 and permission 30 — each statement pins id **and** email/code.
2. `UPDATE` users 2, 5 and organizations 2, 3 → `is_active=false, deleted_at=now()`.
3. Assert: still exactly 7 audit rows, both audit triggers still enabled, the real org/user untouched.

It never touches `audit_logs`, never runs `ALTER TABLE … DISABLE TRIGGER`, never changes `session_replication_role`.

## How the SQL was validated (without touching dev)

Dumped dev (read-only) into a throw-away database, ran the file there, then dropped it:

- before: orgs 3, users 5, test permission 1, audit 7 → after: audit **7**, triggers enabled **2**, test permission **0**; users 2/5 and orgs 2/3 inactive+soft-deleted; user 1 / org 1 untouched.
- re-running it fails its own precondition (`expected 4 test users, found 2`) — it cannot double-apply.
- dev afterwards: `orgs=3 users=5 audit=7 deleted_orgs=0` — unchanged.

**Awaiting your approval of the exact SQL before anything runs against `texawave_erp`.**
