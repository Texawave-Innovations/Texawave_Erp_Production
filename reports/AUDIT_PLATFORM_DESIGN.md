# Audit Platform — Design (proposal, nothing implemented)

|                    |                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**         | Design for review. No schema, migration, code or dependency has been added.                                                                                                                      |
| **Repo / branch**  | `Texawave_Erp_Production`, `feature/HR` (based on `main` @ `73bbb16`)                                                                                                                            |
| **Why now**        | The HR brief requires an audit trail for employee, status, mapping, shift, calendar and leave changes. `platform/audit` is documented (`Docs/ARCHITECTURE.md` §3, §5.4, §10) but does not exist. |
| **Needs sign-off** | New migration (`packages/database/prisma/migrations/`), new platform module, and the append-only exception to the §5.1 baseline columns (§3).                                                    |

Labels: **[Verified]** read in this repo · **[Docs]** stated in `Docs/` · **[Proposal]** mine · **[Decision]** needs a human.

---

## 1. What the architecture already says

- **[Docs]** `audit_logs (id, org_id, actor_id, entity_type, entity_id, action, before jsonb, after jsonb, ip, at)`, polymorphic `entity_type + entity_id`; `BigInt` id (with `status_history`, the only two BigInt tables) — `ARCHITECTURE.md` §5.1, §5.4.
- **[Docs]** A "global `AuditInterceptor`" populates it; a read-only query surface sits on top (§8 "Audit").
- **[Docs]** Reads of payroll/sensitive data are logged too, not only writes (§10). PII lives in `employee_sensitive_info` behind its own permission.
- **[Verified]** None of it exists. The request pipeline has `ResponseInterceptor`, `TenancyInterceptor` (fills CLS with `organizationId`, `userId`, `roleIds`, `correlationId`) and `AllExceptionsFilter`; correlation id is already propagated.
- **[Verified]** Lint rules: controllers and **services may not import Prisma**; only `*.repository.ts` touches `PrismaService`. There is **no transaction helper** — the only transaction in the codebase is the array form `$transaction([...])` in `roles.repository.ts`.
- **[Verified]** There is no event bus and none is being added (`@nestjs/event-emitter` is not installed; adding a dependency needs review).

## 2. Design goals (from the HR brief)

1. Every sensitive HR change records **who, when, what entity, what operation, and the change**.
2. The audit row and the business change **commit or roll back together** — no "changed but not logged".
3. **Append-only**, enforced by the database, not by convention.
4. **No secrets** (passwords, tokens, activation tokens) and no unnecessary PII in the log.
5. Org-scoped reads; a small, permissioned, read-only query API.
6. Works for background actors (system jobs such as auto-checkout later) as well as users.

## 3. Proposed table

`audit_logs` — **[Proposal]**, following the documented shape with the additions needed for the goals above:

| Column            | Type                                                                       | Notes                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `BigInt` identity                                                          | per §5.1                                                                                                                                                       |
| `organization_id` | `Int` FK                                                                   | every query is org-scoped                                                                                                                                      |
| `actor_user_id`   | `Int?` FK `users` (users are soft-deleted, so the reference never dangles) | `NULL` only for `actor_type='system'`                                                                                                                          |
| `actor_type`      | `text` + `CHECK IN ('user','system')`                                      | jobs/migrations are not users                                                                                                                                  |
| `entity_type`     | `text`                                                                     | lower_snake, e.g. `employee`, `shift_assignment`, `leave_request`                                                                                              |
| `entity_id`       | `BigInt`                                                                   | all current PKs are `Int`/`BigInt`; the natural key of the audited row                                                                                         |
| `action`          | `text`                                                                     | `create`, `update`, `status_change`, `link_user`, `approve`, `reject`, `cancel`, `read_sensitive`, … (closed list per entity, defined in code)                 |
| `before`, `after` | `jsonb?`                                                                   | allow-listed snapshots, see §5. Two columns as documented in §5.4 rather than one `changes` blob, so "who set `status` to X" is queryable — **[Decision A-1]** |
| `reason`          | `text?`                                                                    | free text captured for corrections / status changes                                                                                                            |
| `ip`              | `inet?`                                                                    | from the request; `NULL` for system                                                                                                                            |
| `correlation_id`  | `text?`                                                                    | joins the row to the request's logs (already in CLS)                                                                                                           |
| `at`              | `timestamptz(6)` default `now()`                                           | **timestamptz** (repo default `TIMESTAMP(3)` is not time-zone aware — see readiness decision D-12)                                                             |

**Deliberately absent:** `updated_at`, `deleted_at`, `is_active`, `updated_by`. The §5.1 "baseline columns" contradict an append-only log; this table is an explicit, documented exception (needs reviewer sign-off — it is the one table that must never be soft-deleted or edited).

**Indexes** (from the query patterns in §7): `(organization_id, entity_type, entity_id, id DESC)` — "history of this employee"; `(organization_id, actor_user_id, id DESC)` — "what did this person do"; `(organization_id, at)` — date-range browsing. `id` is monotonic, so pagination is keyset on `id`.

**Immutability in the database** (raw SQL in the migration, documented there — Prisma cannot express it, and §3.7 of the earlier analysis showed raw-SQL objects do not upset the CI drift check):

- `BEFORE UPDATE OR DELETE` row trigger that raises an exception;
- `BEFORE TRUNCATE` statement trigger that raises;
- `CHECK (actor_type = 'system' OR actor_user_id IS NOT NULL)`.

A superuser can still drop the triggers, and a single application role cannot be made unable to — this is tamper-_resistance_ against application bugs, not against a DBA. Stronger controls (separate write-only DB role, WORM export) are out of scope and noted as a limitation.

## 4. How records get written

Two mechanisms, deliberately different — **[Proposal]**, and a deviation from the doc's single "global interceptor" (**[Decision A-2]**):

**4.1 Mutations: explicit, transactional, service-driven.** A generic interceptor cannot know the _before_ state, cannot see the business meaning (`approve` vs `update`), and would either miss changes made inside services or log PII by diffing whole rows. So the module that owns the mutation writes the audit row **inside the same database transaction** as the change:

```
repository.updateWithAudit(scope, id, patch, auditCtx)
  └─ prisma.$transaction(async tx => {
       const before = await tx.employee.findFirst(...)      // scoped read
       const after  = await tx.employee.update(...)
       await auditWriter.write(tx, { entityType, entityId, action, before, after, reason, ... })
     })
```

- `AuditWriter` (platform/audit, exported) is a provider whose only method takes a **Prisma transaction client** — it never opens its own connection, so it cannot commit independently of the caller. It pulls `organizationId`, `userId`, `ip` and `correlationId` from CLS itself, so a caller cannot forge the actor (**"use the authenticated identity as the authority"**).
- This fits the existing lint rules: the _repository_ holds the `tx`; the service only passes an `AuditContext` (`{ action, reason? }`) down — no Prisma in services or controllers.
- If the audit insert fails, the transaction rolls back and the request fails. **Fail-closed** — an unlogged HR change must not exist.
- **No shared-code change is needed for transactions:** repositories call `this.prisma.$transaction(async tx => …)` directly (`roles.repository.ts` already uses the array form). Nothing in `shared/prisma` is modified.

**4.2 Reads of sensitive data: a small interceptor.** Where an interceptor is the right tool: `@AuditRead({ entityType, idParam })` on the few endpoints that expose sensitive data (`employee_sensitive_info`, later payroll). It writes `read_sensitive` (entity, id, actor, ip) **before** the response is returned. **[Decision A-3]** fail-closed here too (no audit → no data), accepting that an audit outage blocks those reads; the alternative (best-effort, log the failure) is weaker for exactly the data that matters most. Recommended: fail-closed.

**4.3 System actors.** Jobs pass `{ actorType: 'system', actorLabel: 'auto-checkout' }`; there is no user in CLS, so the writer requires it explicitly and stores `actor_type='system'` (no `actor_user_id`).

## 5. What goes in `changes` (and what never does)

- Each audited module provides a **snapshot mapper** — a function from its entity to a small plain object of _allow-listed_ fields. The writer stores `before`/`after` snapshots from those mappers, never raw Prisma rows. New columns are therefore **not logged until someone adds them** (safe default).
- A global **deny-list** is applied as a second net regardless of mapper: keys matching `password`, `passwordHash`, `token`, `tokenHash`, `secret`, `authorization`, `refresh`, `activation`, `otp` are dropped, at any depth.
- `employee_sensitive_info` (PAN/Aadhaar/bank): the audit row records **which fields changed, not their values** (`{"changedFields": ["bank_account"]}`).
- Size guard: a snapshot larger than a fixed cap (e.g. 16 KB) is rejected at write time (fail loud in tests), not silently truncated.
- Tests assert the deny-list with a fixture containing a password, a token hash and a nested secret.

## 6. Read API (read-only)

- `GET /audit/logs` — filters `entityType`, `entityId`, `actorUserId`, `action`, `from`, `to`; keyset pagination on `id`; org-scoped; `@RequirePermission("audit.log.read")` (no team dimension at first, so no `.own/.team/.all`) — **[Decision A-4]** whether team leads may see their team's employee history (would need `audit.log.read.team` and a join through `employees`; not proposed for v1).
- Domain convenience routes (`GET /hr/employees/:id/history`) are thin wrappers in the HR module calling an exported `AuditQueryService` — HR never imports the audit repository (import-boundary rule).
- No create/update/delete API exists, by construction.
- Returned rows expose actor id and display name only; `ip` is returned only to holders of the read permission and never to self-service users.

## 7. Employee status history — related, separate

`Docs/ARCHITECTURE.md` §5.4 pairs workflows with a generic `status_history (from_status_id, to_status_id → statuses)`. That presumes the `statuses` lookup table, which does not exist and which the HR brief moves away from (text + `CHECK`). **[Proposal]** a domain table `employee_status_history` (from/to status text, effective date, reason, changed_by, at) owned by HR, _plus_ the `audit_logs` row. Audit is "what happened and who did it" for forensics; status history is a business record HR queries and attendance/payroll rely on. Details belong in the HR schema design, not here.

## 8. Files (when approved)

```
apps/api/src/platform/audit/
  audit.module.ts                 # Global; exports AuditWriter, AuditQueryService
  audit-writer.ts                 # write(tx, entry) — the only writer
  audit-redaction.ts              # deny-list + size cap (pure, unit-tested)
  audit.repository.ts             # reads only
  audit-query.service.ts
  audit.controller.ts             # GET /audit/logs
  audit-read.decorator.ts + audit-read.interceptor.ts   # @AuditRead for sensitive reads
  dto/query-audit-log.dto.ts
packages/database/prisma/schema.prisma      # AuditLog model
packages/database/prisma/migrations/<ts>_add_audit_logs/migration.sql  # + immutability triggers (raw SQL, commented)
packages/database/prisma/permissions/catalog.ts  # audit.log.read
Docs/ARCHITECTURE.md §3/§5.4/§11            # reflect what was actually built + the deviations
apps/api/src/app.module.ts                  # import AuditModule
```

## 9. Test plan

| Layer              | Cases                                                                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | redaction (nested secrets, deny-list, case-insensitive keys, size cap); snapshot mappers are allow-lists; writer refuses a missing org/actor; system-actor path                                                                                             |
| DB (disposable DB) | `UPDATE`/`DELETE`/`TRUNCATE` on `audit_logs` raise; `CHECK` on actor; keyset ordering; index used (`EXPLAIN`) for the entity-history query                                                                                                                  |
| Transactional      | mutation + audit commit together; forced audit failure rolls the business change back; forced business failure leaves **no** audit row                                                                                                                      |
| e2e                | actor comes from the JWT, never the body; org isolation (404/empty across orgs); read permission enforced (401/403/200); `@AuditRead` writes exactly one row per read and blocks when the write fails; no secret ever appears in a response or a stored row |

## 10. Risks and limitations

- Table growth is unbounded by design; partitioning by month and an archive policy are future work (BigInt id chosen for this reason). No deletion is ever performed.
- Audit correctness depends on each module using `updateWithAudit`-style repository methods; a reviewer checklist item is added ("every HR write path calls `AuditWriter`") and the transactional tests are per-entity. A raw `prisma.employee.update` outside those methods would be un-audited — mitigated by review, not by code.
- Immutability triggers stop application bugs, not a privileged DBA.
- Fail-closed makes the audit table an availability dependency of HR writes.

## 11. Decisions needed

| ID  | Question                                                                                                              | Recommendation                                            |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A-1 | Separate `before`/`after` columns (as documented) vs one combined diff column                                         | Separate `before`/`after` — queryable and matches the doc |
| A-2 | Explicit transactional writes for mutations + interceptor only for sensitive reads, instead of one global interceptor | Yes                                                       |
| A-3 | Sensitive reads: fail-closed or best-effort                                                                           | Fail-closed                                               |
| A-4 | Team-lead visibility of audit history                                                                                 | Not in v1; `audit.log.read` (org-wide) only               |
| A-5 | Append-only exception to the §5.1 baseline columns                                                                    | Approve                                                   |
| A-6 | Employee status history as an HR table separate from `audit_logs`                                                     | Yes                                                       |
