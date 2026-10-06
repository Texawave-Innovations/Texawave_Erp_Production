# HR Employee Tickets — API, lifecycle and legacy parity

Every statement is tagged with one of three labels:

- **LEGACY VERIFIED**: read in the legacy source (`TexaWave_ERP`), with the file named.
- **PRODUCTION DECISION**: a choice made here, with the reason. It can be changed.
- **UNRESOLVED**: legacy does not settle it and no decision has been made. Listed in §9.

Items that are neither built nor decided are marked **NOT BUILT** (legacy has the behavior, production does not yet) or **NOT APPLICABLE** (legacy has no such behavior).

Parity findings and the reuse decision live in [HR_LEGACY_PARITY.md](HR_LEGACY_PARITY.md) §3.10 and §6. This document is the implementation reference.

---

## 1. Legacy behavior (verified)

Sources: `src/modules/employee/RaiseTicket.tsx` (employee screen, route `/hr/tickets` for employees), `src/modules/hr/AdminTickets.tsx` (admin screen, route `/hr/tickets`).

| Area                  | Verified behavior                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage               | RTDB `hr/tickets`, one node per ticket.                                                                                                                                                                                                                        |
| Fields                | `category`, `subject`, `description`, `status`, `employeeId`, `employeeName`, `createdAt`, `adminReply?`, `resolvedAt?`, `employeeReply?`, `employeeRepliedAt?`, `createdByAdmin?`, `createdByName?`, `targetEmployeeId?`, `targetEmployeeName?`, `isGlobal?`. |
| Priority              | **None.** Neither screen reads or writes a priority.                                                                                                                                                                                                           |
| Assignment            | **None.** No handler field; a ticket belongs to the employee it is about.                                                                                                                                                                                      |
| Categories (employee) | `Attendance`, `Salary`, `Leave`, `Documents`, `IT Support`, `HR Query`, `Other`. Default `HR Query`.                                                                                                                                                           |
| Categories (admin)    | The seven above plus `Notice` and `Warning`. Default `Notice`.                                                                                                                                                                                                 |
| Status                | `open`, `in_progress`, `resolved`, `closed`.                                                                                                                                                                                                                   |
| Create (employee)     | Requires subject and description. Creates `open`. Notifies the admin feed.                                                                                                                                                                                     |
| Create (admin)        | Requires subject and description, and either one employee or `Send to All`. Creates `open` with `createdByAdmin`. Notifies the employee.                                                                                                                       |
| Broadcast             | `Send to All` writes **one ticket per employee**, each with `isGlobal: true`. Verified in `AdminTickets.tsx` `handleCreate`.                                                                                                                                   |
| Edit (employee)       | The employee can change category, subject and description (`RaiseTicket.tsx` `handleUpdateTicket`). No status guard appears in the code read.                                                                                                                  |
| Employee reply        | On an **admin-raised** ticket only (`RaiseTicket.tsx` reply form in the notices section). Single field `employeeReply`; a second reply overwrites the first.                                                                                                   |
| Admin reply           | Single field `adminReply`, sent with a status change (`AdminTickets.tsx` `handleUpdate`). Overwrites the previous reply. Reply box shown only for active tickets.                                                                                              |
| Status change (admin) | A dropdown with all four values, on active tickets. Any status may move to any other (no transition guard in code).                                                                                                                                            |
| Reopen (admin)        | A **Reopen** button on resolved or closed tickets sets `status = open`. `resolvedAt` is not cleared.                                                                                                                                                           |
| Resolved stamp        | `resolvedAt` is set when status becomes `resolved` or `closed`.                                                                                                                                                                                                |
| Delete                | **None.** No delete control or code path in either screen.                                                                                                                                                                                                     |
| Cancel                | **None.** No cancel status exists.                                                                                                                                                                                                                             |
| Search                | Employee: subject, description or category (case-insensitive substring), client-side. Admin: subject, employee name or category.                                                                                                                               |
| Filters               | Employee: status. Admin: summary cards for employee open, in progress, admin active, resolved/closed.                                                                                                                                                          |
| Pagination            | None. The whole collection is loaded.                                                                                                                                                                                                                          |
| Length limits         | None on subject, description or reply.                                                                                                                                                                                                                         |
| Notifications         | Sent on employee create and reply (to the admin feed), and on admin create and status change (to the employee).                                                                                                                                                |
| Attachments           | **None.** No file field on tickets.                                                                                                                                                                                                                            |
| Audit / history       | None. Each reply overwrites the previous one; no history is kept.                                                                                                                                                                                              |

---

## 2. Production implementation

| Area                    | Production behavior                                                                                                             | Label                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Storage                 | `hr.tickets` (Prisma `Ticket`, migration `20261006120000_add_hr_tickets`). Replies in `hr.ticket_comments` (`TicketComment`).   | PRODUCTION DECISION (replies as history, see below)                                   |
| Ids                     | `Int` autoincrement.                                                                                                            | Repo convention                                                                       |
| Requester               | `employeeId`. Admin-raised and employee-raised tickets both name the employee they are about.                                   | LEGACY VERIFIED (`employeeId`)                                                        |
| Raiser                  | `raisedByAdmin` plus `raisedByUserId` (the admin's user) on admin-raised tickets.                                               | LEGACY VERIFIED (`createdByAdmin`, `createdByName`)                                   |
| Category                | Stored as text, checked against the nine legacy values. Employees may raise the seven employee values only.                     | LEGACY VERIFIED (values and the employee/admin split)                                 |
| Priority                | Not stored.                                                                                                                     | **NOT APPLICABLE** (legacy has none)                                                  |
| Subject / description   | Required, not blank (DB CHECK). Subject 1–200, description 1–5000, reply 1–2000.                                                | LEGACY VERIFIED (required); PRODUCTION DECISION (caps; legacy had none)               |
| Status                  | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. Upper-cased, as the other HR enums.                                                | LEGACY VERIFIED (values)                                                              |
| Reply history           | Every reply is an appended row in `ticket_comments`. Legacy kept only the last reply.                                           | PRODUCTION DECISION (the spec requires history to be preserved)                       |
| `resolvedAt`            | Stamped on `RESOLVED` or `CLOSED`, kept on reopen.                                                                              | LEGACY VERIFIED (stamp); PRODUCTION DECISION (not cleared on reopen, matching legacy) |
| Employee on-behalf rule | An employee who has left (`RESIGNED`, `TERMINATED`) cannot have a ticket raised for them.                                       | PRODUCTION DECISION (same rule as task assignment)                                    |
| Overdue / SLA           | None.                                                                                                                           | **NOT BUILT / UNRESOLVED K4** (none in legacy)                                        |
| Attachments             | None.                                                                                                                           | **NOT APPLICABLE** (legacy has none; K5)                                              |
| Delete                  | None offered.                                                                                                                   | LEGACY VERIFIED (no delete control)                                                   |
| Audit snapshot          | Business facts only: employee, category, status, origin flag, `resolvedAt`. Subject, description and reply bodies are excluded. | PRODUCTION DECISION (follows the task snapshot)                                       |

### 2.1 Database invariants (`hr.tickets`, `hr.ticket_comments`)

- `tickets.status` ∈ the four statuses; `category` ∈ the nine legacy values.
- `subject` and `description` are not blank.
- `raised_by_admin = true` requires `raised_by_user_id`; `false` requires it to be null.
- `status` ∈ (`RESOLVED`, `CLOSED`) requires `resolved_at`.
- `ticket_comments.author_kind` ∈ (`HR`, `EMPLOYEE`); an HR reply names a user and no employee, an employee reply names an employee and no user.
- `ticket_comments.body` is not blank.
- `ticket_comments` is **append-only**: `UPDATE`, `DELETE` and `TRUNCATE` are rejected by triggers using the platform `prevent_row_mutation` function (the one `audit_logs` uses).

Foreign keys use `ON DELETE RESTRICT`.

---

## 3. Ticket lifecycle

```
            admin raise / employee raise
                       │
                       ▼
                     OPEN ◀──────────── reopen (admin) ─────────┐
                  │ ▲   │                                       │
   move (admin)   │ │   │ resolve / close (admin)               │
                  ▼ │   ▼                                       │
             IN_PROGRESS  ──▶  RESOLVED  ──────────────────────┤
                  │              │ ▲                            │
                  │ close        │ │ close (admin)              │
                  ▼              ▼ │                            │
                CLOSED ──────────────────────────────────────────┘
                                 (CLOSED may only be reopened)
```

Admin moves (`POST /hr/tickets/:id/status`):

| From          | Allowed to                          |
| ------------- | ----------------------------------- |
| `OPEN`        | `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `IN_PROGRESS` | `OPEN`, `RESOLVED`, `CLOSED`        |
| `RESOLVED`    | `OPEN` (reopen), `CLOSED`           |
| `CLOSED`      | `OPEN` (reopen) only                |

- A move to the current status is a `200` no-op: nothing is written and no audit row is made.
- Any other move is `422 INVALID_STATE_TRANSITION`.
- Legacy allowed any status to any other (LEGACY VERIFIED). The table above is a **PRODUCTION DECISION** that closes sideways moves. It is listed in §9 for confirmation.

Employee actions (self-service):

- Raise: creates `OPEN`.
- Edit: only while the ticket is `OPEN` and was raised by the employee (see §4.2). The employee cannot change status.

Replies:

- **HR** may reply only while the ticket is `OPEN` or `IN_PROGRESS`. Legacy showed the reply box only for active tickets (LEGACY VERIFIED). A reply does not change status; the legacy "reply and change status in one action" is two calls here.
- **Employee** may reply only on a ticket HR raised for them (LEGACY VERIFIED: the reply form is on admin notices only). The reply is accepted in any status; legacy had no status guard on that form.

Concurrency: every status change and every reply takes `SELECT … FOR UPDATE` on the ticket row, re-reads it inside the transaction, validates the rule against that read, then writes and audits in the same transaction. Two identical concurrent moves produce one audit row (covered by an e2e test).

---

## 4. API

Response envelope and pagination follow the platform standard (`PaginatedResponseDto`). Errors use the `BusinessException` `error` code.

### 4.1 HR / admin surface — `/hr/tickets`

| Method | Path                       | Permission                   | Purpose                                                                                                                   | Success | Errors                                                    |
| ------ | -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| GET    | `/hr/tickets`              | `hr.ticket.read` (any scope) | List in scope. Filters: `status`, `category`, `employeeId`, `q` (subject, category, employee name), paging. Newest first. | 200     | 401, 403                                                  |
| GET    | `/hr/tickets/:id`          | `hr.ticket.read`             | One ticket in scope, with `comments` oldest first.                                                                        | 200     | 404 (outside scope, not 403)                              |
| POST   | `/hr/tickets`              | `hr.ticket.write`            | Raise a ticket for an employee in scope. Body: `employeeId`, `category`, `subject`, `description`.                        | 201     | 400, 403, 422 `INVALID_EMPLOYEE`, 422 `EMPLOYEE_HAS_LEFT` |
| POST   | `/hr/tickets/:id/status`   | `hr.ticket.write`            | Move status. Body: `status`. A move back to `OPEN` from `RESOLVED`/`CLOSED` is a reopen.                                  | 200     | 400, 404, 422 `INVALID_STATE_TRANSITION`                  |
| POST   | `/hr/tickets/:id/comments` | `hr.ticket.write`            | HR reply. Body: `body`. Appends.                                                                                          | 201     | 400, 404, 422 `TICKET_NOT_ACTIVE`                         |

### 4.2 Self-service surface — `/self-service/tickets`

| Method | Path                                 | Permission                            | Purpose                                                                                                          | Success | Errors                                                                                                  |
| ------ | ------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/self-service/tickets`              | `employee_self_service.ticket.read`   | My tickets: raised by me or by HR for me. Filters: `status`, `q` (subject, description, category). Newest first. | 200     | 401, 403                                                                                                |
| GET    | `/self-service/tickets/:id`          | same                                  | One of my tickets, with `comments`.                                                                              | 200     | 404                                                                                                     |
| POST   | `/self-service/tickets`              | `employee_self_service.ticket.create` | Raise a ticket to HR. Body: `category`, `subject`, `description`.                                                | 201     | 400, 422 `CATEGORY_NOT_ALLOWED`                                                                         |
| PATCH  | `/self-service/tickets/:id`          | `employee_self_service.ticket.update` | Edit my open, self-raised ticket. Body: all of `category`, `subject`, `description`.                             | 200     | 400, 404, 422 `TICKET_NOT_EDITABLE`, 422 `ADMIN_RAISED_TICKET_NOT_EDITABLE`, 422 `CATEGORY_NOT_ALLOWED` |
| POST   | `/self-service/tickets/:id/comments` | `employee_self_service.ticket.update` | Reply on a ticket HR raised for me. Body: `body`.                                                                | 201     | 400, 404, 422 `REPLY_NOT_ALLOWED`                                                                       |

The employee is always resolved from the JWT. A request body that names an employee is rejected (`400`), because the DTOs have no such field and the global validation pipe forbids unknown fields.

---

## 5. Permissions

| Code                                  | Scope                             | Granted to (defaults) | Notes                                                     |
| ------------------------------------- | --------------------------------- | --------------------- | --------------------------------------------------------- |
| `hr.ticket.read.{own,team,all}`       | Team-scoped (the employee's team) | HR Manager `.all`     | `.own` means the employee is the caller.                  |
| `hr.ticket.write.{own,team,all}`      | Team-scoped                       | HR Manager `.all`     | `.own` is reserved and refused (403) on every write.      |
| `employee_self_service.ticket.read`   | Own                               | Employee              | Raised by me or by HR for me.                             |
| `employee_self_service.ticket.create` | Own                               | Employee              |                                                           |
| `employee_self_service.ticket.update` | Own                               | Employee              | Edit (open, self-raised only) and reply (HR-raised only). |

Decisions:

- **No separate respond permission.** The parity doc listed `hr.ticket.respond`. Replies and status changes ride on `hr.ticket.write`, as task approval does. PRODUCTION DECISION.
- **Team Lead is read-only and gets no ticket permission.** Legacy has no team-lead view of tickets, and the default-role test pins team leads as read-only.
- No default role holds a `.team` write permission (existing pinned decision).

---

## 6. Scope rules

- **Organization isolation:** every query is built with `tenantWhere()` or `teamWhere()`, which always AND the organization id. A ticket in another organization returns 404.
- **Team scope:** HR reads and writes are narrowed by `employee.teamId` through `teamWhere()`. Raising a ticket for an employee outside the caller's scope is `422 INVALID_EMPLOYEE`, the same answer as an employee that does not exist.
- **Self scope:** `organization AND employee = me`. Another employee's ticket is 404, on every route, including comments.
- **Employee search is self-only:** the self list's `q` does not match the employee name, so it cannot be used to search others.
- **Not-found over forbidden:** a row outside scope is 404 on every surface, so ids cannot be probed.

---

## 7. Audit

Writes go through `AuditWriter` in the same transaction as the change. Entity type is `ticket`.

| Action          | When                                                | Snapshot                         |
| --------------- | --------------------------------------------------- | -------------------------------- |
| `create`        | HR or employee raises a ticket                      | after: business facts            |
| `update`        | Employee edits their ticket                         | before/after: business facts     |
| `status_change` | HR moves status (not a reopen)                      | before/after: status and facts   |
| `reopen`        | HR moves a resolved or closed ticket back to `OPEN` | before/after: status and facts   |
| `comment`       | HR or employee posts a reply                        | after: `commentId`, `authorKind` |

- Subject, description and reply bodies are never in a snapshot.
- Actor, organization, IP and correlation id come from the request context, never from the body.
- Not audited: no-op status moves and rejected requests (they write nothing).
- Legacy kept no history (LEGACY VERIFIED), so every row here is new behavior.

---

## 8. Test coverage

| Suite        | File                                                      | What it proves                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules unit   | `apps/api/src/modules/hr/tickets/tickets.rules.spec.ts`   | Every allowed and refused admin move, the no-op rule, reopen detection, employee edit and reply rules, the employee category set.                                                                                                                                          |
| Service unit | `apps/api/src/modules/hr/tickets/tickets.service.spec.ts` | Scope resolution, `.own` refused on HR writes, identity from the JWT, rejected categories before any write, 404 on out-of-scope rows, the self list ignoring any employee filter.                                                                                          |
| E2E          | `apps/api/test/hr-tickets.e2e-spec.ts`                    | Auth and permission, employee self-service and IDOR, HR raising, team scope, organization isolation, the lifecycle (resolve, reopen, close, invalid moves), comments and their order, concurrency on one row, audit contents, and database CHECK and append-only triggers. |
| DB           | `packages/database/prisma/permissions/*.test.ts`          | Catalogue validity and default-role invariants.                                                                                                                                                                                                                            |

---

## 9. Unresolved and open

These are not decided and are not silently filled in.

| #   | Question                                                                        | Status                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Category list.                                                                  | **Decided** as the legacy values. Employee set is the seven; admin set is nine. Owner may still change it.                                                                                                      |
| K2  | May an employee edit a ticket after HR has picked it up?                        | **PRODUCTION DECISION: no (open only).** Legacy has no guard. Confirm with the business.                                                                                                                        |
| K3  | May a closed ticket be reopened?                                                | **LEGACY VERIFIED: yes** (admin Reopen button on resolved and closed). Implemented.                                                                                                                             |
| K4  | SLA or response time.                                                           | **None observed.** Not built.                                                                                                                                                                                   |
| K5  | Attachments.                                                                    | **None in legacy.** Not built. Blocked on document storage (D1) if ever needed.                                                                                                                                 |
| K6  | Legacy allowed any status to any other. Production allows only the table in §3. | **PRODUCTION DECISION.** Confirm before go-live.                                                                                                                                                                |
| K7  | Should an employee be able to reply on a ticket after HR closes it?             | Legacy has no guard, so the reply is allowed in any status. **Open.**                                                                                                                                           |
| B1  | **Broadcast (`Send to All`).** Legacy writes one ticket per employee.           | **NOT BUILT.** It needs a bulk-write design (one row per employee in one transaction, with one audit row each) and a decision on how notices reach employees who are out of scope. Left for a dedicated change. |
| B2  | Notifications on create, reply and status change.                               | **NOT BUILT.** Production has no notification model (the same gap as task assignment, U4).                                                                                                                      |
| B3  | Handler assignment: should a ticket have an owner in HR?                        | **Not in legacy.** Not built. **Business decision** whether tickets need an owner.                                                                                                                              |
| B4  | Whether a team lead may view team tickets.                                      | **Open business decision.** Default roles do not grant it.                                                                                                                                                      |
| B5  | Whether an employee may read the audit trail of their own ticket.               | Not exposed. The audit log is an HR/admin surface. **Open.**                                                                                                                                                    |
