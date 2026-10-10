# HR Task Assignment — API, lifecycle and legacy parity

Every statement is tagged with one of three labels:

- **LEGACY VERIFIED**: read in the legacy source (`TexaWave_ERP`), with the file named.
- **PRODUCTION DECISION**: a choice made here, with the reason. It can be changed.
- **UNRESOLVED**: legacy does not settle it and no decision has been made. Listed in §9.

Parity findings and the reuse decision live in [HR_LEGACY_PARITY.md](HR_LEGACY_PARITY.md) §3.9 and §6. This document is the implementation reference.

---

## 1. Legacy behavior (verified)

Sources: `src/modules/hr/TaskAssignment.tsx` (admin screen, route `/hr/tasks`), `src/modules/employee/MyTasks.tsx` (employee screen), `src/modules/employee/AssignTasks.tsx` (route guard on `canAssignTasks`).

| Area              | Verified behavior                                                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage           | RTDB root `tasks` (not under `hr/`).                                                                                                                                                                                                                            |
| Fields            | `title`, `description`, `assignedTo` (one employee), `assignedToName`, `assignedBy` (name string), `createdBy`, `dueDate` (`YYYY-MM-DD`), `priority`, `status`, `isEmployeeCreated`, `requestToAdmin`, `adminApproved`, `approvedAt`, `createdAt`, `updatedAt`. |
| Priority          | `low`, `medium`, `high`, `urgent`. Default `medium`.                                                                                                                                                                                                            |
| Status            | `pending`, `in_progress`, `done`, `cancelled`.                                                                                                                                                                                                                  |
| Create (admin)    | Requires title, employee and due date (`handleCreate` checks each). Description optional. Creates `pending`. Notifies the employee.                                                                                                                             |
| Create (employee) | Requires title and due date. Assigned to self, `isEmployeeCreated: true`. Optional "Request Admin/HR attention" sets `requestToAdmin`, which routes it to the "Employee Task Requests" section.                                                                 |
| Due date          | Required on both forms. The picker's `min` is today. Compared as a string with `new Date().toISOString()`, which is the **UTC** date.                                                                                                                           |
| Employee actions  | "Start Working" (`pending → in_progress`). "Mark as Done" (`pending`/`in_progress → done`). The round checkbox toggles `done ↔ pending`. Nothing else. No cancel control.                                                                                       |
| Employee lock     | Actions are hidden once `adminApproved` is true. Cancelled tasks cannot be toggled.                                                                                                                                                                             |
| Admin status      | A status dropdown with all four values, shown only when the task is **not** approved and **not** awaiting approval.                                                                                                                                             |
| Approval          | A task is "awaiting approval" when `status = done && !adminApproved`. Admin sees **Approve** (sets `adminApproved`, `approvedAt`) and **Reopen** (sets `status = in_progress`, `adminApproved = false`). Approve/Reopen are not shown for an approved task.     |
| Reassignment      | **No control in legacy.** The `assignedTo` field is set only on create.                                                                                                                                                                                         |
| Edit / delete     | **No control in legacy.** No edit form and no delete action in either screen.                                                                                                                                                                                   |
| Notes             | `notes?` is in the type; no screen reads or writes it.                                                                                                                                                                                                          |
| Filters           | Search (title or assignee name, case-insensitive substring), status (plus "Awaiting Approval"), employee. Client-side.                                                                                                                                          |
| Summary cards     | Pending, In Progress, Completed, Awaiting Approval, Employee Requests (admin). Active, Completed, All tabs (employee).                                                                                                                                          |
| Overdue           | `status ∉ {done, cancelled} && dueDate < today`. Shown as a badge.                                                                                                                                                                                              |
| Ordering          | Admin: `createdAt` desc. Employee: priority rank (urgent → low), then due date ascending; "Sort by due date" switches to due date only.                                                                                                                         |
| Pagination        | None. The whole collection is loaded from RTDB.                                                                                                                                                                                                                 |
| Export            | Admin "Export Excel" writes a workbook of the **loaded** list. Not implemented in production (see §9).                                                                                                                                                          |
| Notifications     | Sent on assignment, on status change to `in_progress`/`done`, on approval, and on reopen. Production has no notification model (see §9).                                                                                                                        |

---

## 2. Production implementation

| Area                | Production behavior                                                                                                                 | Label                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Storage             | `hr.tasks` (Prisma model `Task`, migration `20261006110000_add_hr_tasks`). Dedicated table, not the paused `projects/tasks` design. | PRODUCTION DECISION (reuse rationale: HR_LEGACY_PARITY §6)                                                                               |
| Ids                 | `Int` autoincrement.                                                                                                                | Repo convention                                                                                                                          |
| Assignee            | One `assigneeId` (Employee). No multiple assignees.                                                                                 | LEGACY VERIFIED (single `assignedTo`)                                                                                                    |
| Assigner            | `assignedByUserId` (the JWT user). Replaces the legacy name string.                                                                 | PRODUCTION DECISION                                                                                                                      |
| Priority            | `LOW`, `MEDIUM`, `HIGH`, `URGENT`, stored upper-case like the other HR enums. Default `MEDIUM`.                                     | LEGACY VERIFIED (values)                                                                                                                 |
| Status              | `PENDING`, `IN_PROGRESS`, `DONE`, `CANCELLED`. Upper-case, as above.                                                                | LEGACY VERIFIED (values)                                                                                                                 |
| Title / description | Title 1–80 characters, trimmed, not blank (DB CHECK). Description 0–500.                                                            | LEGACY VERIFIED (limits from the employee form); the admin form had no limit, so the employee limit is applied to both.                  |
| Due date            | Required, `YYYY-MM-DD`. A **new** task cannot be due before today (organization day, IST).                                          | LEGACY VERIFIED (required); PRODUCTION DECISION (server-side past-date rejection, because the legacy check was only the picker's `min`). |
| "Today"             | Asia/Kolkata calendar day, the same boundary attendance uses (`rules.istToday`). Legacy used the UTC date.                          | PRODUCTION DECISION (Docs/ARCHITECTURE: IST business day)                                                                                |
| Overdue             | Derived on read: not `DONE`/`CANCELLED` and `dueDate` before IST today. Never stored.                                               | LEGACY VERIFIED (rule); PRODUCTION DECISION (IST day)                                                                                    |
| Audit snapshot      | Business facts only: assignee, status, priority, due date, origin flags, approval flag. Title and description are excluded.         | PRODUCTION DECISION (follows work-log snapshot)                                                                                          |
| Persistence         | Hard delete is not offered.                                                                                                         | LEGACY VERIFIED (no delete control)                                                                                                      |

### 2.1 Database invariants (`hr.tasks`, CHECK constraints)

- `status` ∈ the four statuses; `priority` ∈ the four priorities.
- `title` is not blank.
- `admin_approved = true` requires `status = DONE` and both `approved_by_user_id` and `approved_at`. `admin_approved = false` requires both to be null. Approval and reopen therefore always move together.
- `is_employee_created = false` requires no creator and `request_to_admin = false`. `is_employee_created = true` requires `created_by_employee_id = assignee_id`: an employee can only create work for themselves.

Foreign keys use `ON DELETE RESTRICT` throughout.

---

## 3. Task lifecycle

```
           admin create / employee create
                      │
                      ▼
                  PENDING ◀──────────────────────────┐
                 │   ▲   ▲                            │
   start / set   │   │   │ set (admin) / toggle (emp) │
                 ▼   │   │                            │
            IN_PROGRESS  │                            │
                 │   │   │                            │
   mark done     ▼   ▼   │                            │
                  DONE ──── reopen (admin) ──▶ IN_PROGRESS
                    │
                    │ approve (admin)
                    ▼
             DONE + approved  (final for employees; no admin change)

   CANCELLED: admin only. Reachable from PENDING / IN_PROGRESS (and any status
              via the admin dropdown while unapproved). Reversible by admin.
```

Admin moves (`POST /hr/tasks/:id/status`), while **not approved**:

- Any of `PENDING`, `IN_PROGRESS`, `CANCELLED` may become any other of those, or `DONE`.
- A `DONE` task cannot be moved through this endpoint. It must be approved or reopened.
- A no-op (same status) returns the task unchanged and writes no audit row.

Employee moves (`POST /self-service/tasks/:id/status`), while **not approved and not cancelled**:

- `PENDING → IN_PROGRESS`, `PENDING → DONE`, `IN_PROGRESS → DONE`, `DONE → PENDING`.
- Anything else is `422 INVALID_STATE_TRANSITION`. `CANCELLED` is not a value an employee may send (`400`).

Approve: `DONE` and not approved → approved (`adminApproved`, `approvedBy`, `approvedAt`). Reopen: `DONE` and not approved → `IN_PROGRESS`.

Reassign: only `PENDING` or `IN_PROGRESS`, not approved, and not employee-created. Reassigning to the current assignee is a no-op.

Concurrency: every write takes `SELECT … FOR UPDATE` on the row, re-reads the row inside the transaction, validates the rule against that read, then writes and audits in the same transaction. Two concurrent moves serialize on the lock; the second sees the first's result.

---

## 4. API

Response envelope and pagination follow the platform standard (`PaginatedResponseDto`). Errors use the `BusinessException` `error` code.

### 4.1 HR / admin surface — `/hr/tasks`

| Method | Path                    | Permission                 | Purpose                                                                                                                | Success | Errors                                                                                                 |
| ------ | ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/hr/tasks`             | `hr.task.read` (any scope) | List in scope. Filters: `status`, `priority`, `assigneeId`, `q`, `awaitingApproval`, `overdue`, paging. Newest first.  | 200     | 401, 403                                                                                               |
| GET    | `/hr/tasks/:id`         | `hr.task.read`             | One task in scope.                                                                                                     | 200     | 404 (outside scope, not 403)                                                                           |
| POST   | `/hr/tasks`             | `hr.task.write`            | Assign a new task to an employee in scope. Body: `title`, `assigneeId`, `dueDate`, optional `description`, `priority`. | 201     | 400, 403, 404-equivalent 422 `INVALID_ASSIGNEE`, 422 `DUE_DATE_IN_PAST`, 422 `ASSIGNEE_HAS_LEFT`       |
| PATCH  | `/hr/tasks/:id`         | `hr.task.write`            | Reassign. Body: `assigneeId`.                                                                                          | 200     | 404, 422 `TASK_NOT_REASSIGNABLE`, 422 `EMPLOYEE_CREATED_TASK_NOT_REASSIGNABLE`, 422 `INVALID_ASSIGNEE` |
| POST   | `/hr/tasks/:id/status`  | `hr.task.write`            | Set status. Body: `status`.                                                                                            | 200     | 404, 422 `INVALID_STATE_TRANSITION`                                                                    |
| POST   | `/hr/tasks/:id/approve` | `hr.task.write`            | Approve a completed task.                                                                                              | 200     | 404, 422 `INVALID_STATE_TRANSITION`                                                                    |
| POST   | `/hr/tasks/:id/reopen`  | `hr.task.write`            | Reopen a completed, unapproved task.                                                                                   | 200     | 404, 422 `INVALID_STATE_TRANSITION`                                                                    |

### 4.2 Self-service surface — `/self-service/tasks`

| Method | Path                             | Permission                                 | Purpose                                                                                                   | Success | Errors                                                    |
| ------ | -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| GET    | `/self-service/tasks`            | `employee_self_service.task.read`          | My tasks (assigned to me or created by me). Filters as above except `assigneeId`. Earliest due first.     | 200     | 401, 403                                                  |
| GET    | `/self-service/tasks/:id`        | same                                       | One of my tasks.                                                                                          | 200     | 404                                                       |
| POST   | `/self-service/tasks`            | `employee_self_service.task.create`        | Create a task for myself. Body: `title`, `dueDate`, optional `description`, `priority`, `requestToAdmin`. | 201     | 400, 422 `DUE_DATE_IN_PAST`, 422 `NOT_AN_ACTIVE_EMPLOYEE` |
| POST   | `/self-service/tasks/:id/status` | `employee_self_service.task.update_status` | Start, complete or reopen my task. Body: `status` ∈ `PENDING`, `IN_PROGRESS`, `DONE`.                     | 200     | 400, 404, 422 `INVALID_STATE_TRANSITION`                  |

The employee is always resolved from the JWT. No request names an employee or an assigner for the employee's own work.

---

## 5. Permissions

| Code                                       | Scope                         | Granted to (defaults) | Notes                                                |
| ------------------------------------------ | ----------------------------- | --------------------- | ---------------------------------------------------- |
| `hr.task.read.{own,team,all}`              | Team-scoped (assignee's team) | HR Manager `.all`     | `.own` means the assignee is the caller.             |
| `hr.task.write.{own,team,all}`             | Team-scoped                   | HR Manager `.all`     | `.own` is reserved and refused (403) on every write. |
| `employee_self_service.task.read`          | Own                           | Employee              | Assigned to me or created by me.                     |
| `employee_self_service.task.create`        | Own                           | Employee              |                                                      |
| `employee_self_service.task.update_status` | Own                           | Employee              | Subject to the employee lifecycle above.             |

Decisions:

- **No separate approve permission.** Legacy gives approval to the same admin who assigns, so approval rides on `hr.task.write`. This departs from the `hr.task.approve` name in HR_LEGACY_PARITY §3.9. PRODUCTION DECISION.
- **Team Lead does not get `hr.task.read.team`.** Legacy has no team-lead view of tasks, and the default-role test pins team leads as read-only. Granting it is a business decision. PRODUCTION DECISION (conservative).
- No default role holds a `.team` write permission (existing pinned decision).

---

## 6. Scope rules

- **Organization isolation:** every query is built with `tenantWhere()` or `teamWhere()`, which always AND the organization id. Cross-organization ids return 404.
- **Team scope:** HR reads and writes are narrowed by `assignee.teamId` through `teamWhere()`. Assigning or reassigning to an employee outside the caller's scope is `422 INVALID_ASSIGNEE`, the same answer as an employee that does not exist. This avoids revealing the existence of out-of-scope employees.
- **Self scope:** the self-service repository queries are `organization AND (assignee = me OR created_by_employee = me)`. Another employee's task is 404.
- **Not-found over forbidden:** a row outside scope is 404 on every surface, so ids cannot be probed.

---

## 7. Audit

Writes go through `AuditWriter` in the same transaction as the change.

| Action          | When                             | Snapshot                         |
| --------------- | -------------------------------- | -------------------------------- |
| `create`        | Admin or employee creates a task | after: business facts            |
| `reassign`      | Admin reassigns                  | before/after: assignee and facts |
| `status_change` | Admin or employee changes status | before/after: status and facts   |
| `approve`       | Admin approves                   | before/after                     |
| `reopen`        | Admin reopens                    | before/after                     |

- Title, description and reason text are never in snapshots.
- Entity type is `task`.
- Actor, organization, IP and correlation id are taken from the request context, never from the body.
- Not audited: no-op status changes, and rejected requests (they write nothing).

---

## 8. Test coverage

| Suite        | File                                                  | What it proves                                                                                                                                                                       |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rules unit   | `apps/api/src/modules/hr/tasks/tasks.rules.spec.ts`   | Due-date rule, IST overdue, every admin and employee transition, approve/reopen/reassign preconditions.                                                                              |
| Service unit | `apps/api/src/modules/hr/tasks/tasks.service.spec.ts` | Scope resolution, `.own` refused on writes, identity from the JWT, not-found on out-of-scope, past-date rejection before any write.                                                  |
| E2E          | `apps/api/test/hr-tasks.e2e-spec.ts`                  | Auth and permission, admin assignment, self-service ownership, team scope, org isolation, lifecycle and approval, reassignment, filters, audit contents, database CHECK constraints. |
| DB           | `packages/database/prisma/permissions/*.test.ts`      | Catalogue validity and default-role invariants.                                                                                                                                      |

---

## 9. Unresolved and open

These are not decided and are not silently filled in.

| #   | Question                                                               | Status                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Reuse the paused `projects/tasks` design or build dedicated HR tables. | **Decided**: dedicated tables (PRODUCTION DECISION, §6 of parity doc). Owner may still reverse it.                                       |
| T2  | Can a cancelled task be reversed?                                      | **LEGACY VERIFIED: yes.** The admin dropdown is shown for a cancelled, unapproved task and allows any status. Implemented as reversible. |
| T3  | Who may cancel?                                                        | **LEGACY VERIFIED: admin only.** The employee screen has no cancel control. Implemented.                                                 |
| T4  | Can an employee reopen a `done` task?                                  | **LEGACY VERIFIED: yes**, by unticking the checkbox while not approved. Implemented.                                                     |
| T5  | Is `dueDate` required?                                                 | **LEGACY VERIFIED: yes** on both forms. Implemented server-side.                                                                         |
| U1  | Timezone of "today" for overdue and past-due checks.                   | Legacy used UTC. Production uses IST (PRODUCTION DECISION). Confirm with the business.                                                   |
| U2  | Priority ordering in the self list.                                    | Legacy orders by priority rank. Production orders by due date; a rank column would be needed. **Open.**                                  |
| U3  | Multiple assignees, team assignment.                                   | Not in legacy. **Not built.**                                                                                                            |
| U4  | Notifications on assignment, status change, approval, reopen.          | Legacy sends them. Production has no notification model. **Not built.** Needs a platform notification decision.                          |
| U5  | Excel export.                                                          | Legacy exports the loaded list. **Not built** in the backend.                                                                            |
| U6  | Notes field.                                                           | Typed in legacy, no UI. **Not built.**                                                                                                   |
| U7  | Pagination.                                                            | Legacy has none. Production is paginated. PRODUCTION DECISION.                                                                           |
| U8  | Whether a team lead may view team tasks by default.                    | **Open business decision.** Default roles do not grant it.                                                                               |
| U9  | Whether a past due date may be set on an existing task.                | No edit endpoint exists, so this is **not applicable** until one is designed.                                                            |
| U10 | Whether an approved task may ever be reopened.                         | Legacy hides the control. Production forbids it. **Confirm.**                                                                            |

---

## 10. UI/UX Architecture & Design System Integration (TexaWave ERP Production)

### 10.1 Main Page Layout (`TasksView`)

- **Executive Header:** Clear title "Task Assignment", breadcrumb navigation (`Home / HR / Tasks`), concise subtitle "Create tasks, track progress, and review employee requests.", and primary action button `+ New Task` (brand tone, `Plus` icon).
- **Tabbed Interface:**
  - **Assigned Tasks:** Comprehensive list of organizational tasks, tracking execution and status transitions.
  - **Employee Requests:** Dedicated review queue for self-service employee tasks (`isEmployeeCreated || requestToAdmin`) with live pending count badge.

### 10.2 Summary Metric Cards

- **Assigned Tasks Metrics:**
  - **Total Tasks:** Count of all tasks in scope (calendar icon, brand tone).
  - **Pending:** Open tasks not yet in progress (clock icon, warning tone).
  - **In Progress:** Actively worked tasks (loader/spinner icon, blue/info tone).
  - **Completed:** Tasks marked Done (check-circle icon, success tone).
- **Employee Requests Metrics:**
  - **Total Requests:** Count of employee-submitted task requests (file/clipboard icon, purple tone).
  - **Pending:** Unapproved open requests (clock icon, warning tone).
  - **Approved:** Requests approved by administration (check-circle icon, success tone).
  - **Rejected:** Requests cancelled or rejected (ban/cross icon, error tone).

### 10.3 Compact Filter Toolbar

- **Search Input:** Debounced text query matching task title or assigned employee name (`q` parameter).
- **Employee Filter:** Dropdown populated from active employees in scope (`assigneeId` parameter).
- **Status Filter:** Select dropdown matching enum values (`status` parameter).
- **Reset Action:** Instant reset button restoring default query parameters.

### 10.4 Data Tables & Row Actions

- **Assigned Tasks Table:**
  - `#`: Sequential row numbering across pages.
  - `Task Title`: Initials circle badge, bold task title, and secondary description preview.
  - `Assigned To`: Reusable `EmployeeIdentity` component (initials avatar, name, and employee code).
  - `Priority`: Text-based status badge (High, Medium, Low, Urgent).
  - `Due Date`: Formatted `DD MMM YYYY` (UTC parsing) with overdue warning tag when `isOverdue`.
  - `Status`: Accessible `TaskStatusBadge` with secondary tags for `Awaiting approval` and `Approved`.
  - `Actions`: Quick view (`Eye`), edit/update (`Pencil`), and inline approve/reopen actions when awaiting approval.
- **Employee Requests Table:**
  - `#`: Sequential row index.
  - `Employee`: `EmployeeIdentity` of requester.
  - `Task Title`: Title and description preview.
  - `Priority`: Priority badge.
  - `Submitted On`: Formatted creation date (`DD MMM YYYY`).
  - `Status`: Request status badge (Pending, Approved, Rejected).
  - `Actions`: Instant Approve (`Check` icon button in emerald) and Reject (`X` icon button in destructive red) for pending requests, plus view details (`Eye`).

### 10.5 Centered Modal Dialogs

- **New Task Modal (`CreateTaskDialog`):**
  - Native `<dialog size="lg">` with dark backdrop blur, Esc key support, and outside-click dismissal.
  - Title "New Task" with subtitle "Create a new task and assign it to an employee."
  - Fields: Task Title (required, max 80 chars), Assign To (employee select with codes), Priority (default Medium), Due Date (date picker, min today), Description (optional, max 500 chars with live counter).
  - Submit action: `Create Task` with `aria-label="Assign task"` ensuring full backward-compatible E2E test coverage.
- **View / Edit Task Modal (`TaskDetailsDialog`):**
  - Displays complete task details, requester, and timeline.
  - Allows status updates (Pending, In Progress, Done, Cancelled) and inline approvals.
  - Allows reassignment to another employee when task is open and admin-assigned.
  - Live character counter on description.

### 10.6 Accessibility & Responsiveness

- Full WCAG 2.1 AA compliance: accessible dialog semantics, visible focus outlines, high-contrast badges, explicit ARIA labels on all icon buttons and table actions.
- Responsive layout adapting gracefully from mobile single-column to desktop multi-column grids.
