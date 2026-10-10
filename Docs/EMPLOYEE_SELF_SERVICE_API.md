# Employee Self-Service Portal — API architecture

**Audience:** QA/testers verifying the Employee Portal (`/portal/...`), and UI developers building or
changing a portal page. **Scope:** everything under the `(employee-portal)` route group in
`apps/ui` and its backing API routes. For the dashboard/HR-admin side of the same data, see
[`HR_API.md`](HR_API.md). For how a tab gets added to the portal sidebar in the first place, see
[`MENU_NAVIGATION_API.md`](MENU_NAVIGATION_API.md).

---

## 1. The shape of this surface, in one picture

```
apps/ui/src/app/(employee-portal)/portal/<feature>/page.tsx
            │  thin wrapper, no business logic
            ▼
apps/ui/src/features/employee-self-service/<feature>/
            │  components + hooks + api.ts
            ▼
apps/api/src/modules/employee-self-service/<feature>/*.controller.ts
            │  @RequirePermission("employee_self_service.<feature>.<action>")
            ▼
the SAME underlying tables HR's dashboard uses (employees, leave_requests, tasks, tickets, …)
            │  scoped to "WHERE employee.user_id = :currentUserId" — never an id from the request
```

Every self-service route operates on **the caller's own employee record**, resolved server-side from
the JWT — never from an `id`/`employeeId` in the request body or URL. This is the core invariant of
this whole surface (`ARCHITECTURE.md` §7): an employee cannot pass someone else's id and see their
data, because there is nowhere in these requests to put one.

One exception exists today, deliberately: **Task Assignment** (`/portal/task-assignment`), where a
Team Lead acts on their **team's** tasks, not only their own — see §5.

---

## 2. Permission namespace

Every route below is gated by `employee_self_service.<entity>.<action>` — **never** `hr.*` (the one
documented exception is Task Assignment, §5). This namespace is intentional: an employee's JWT should
never carry an `hr.*` permission just because they can see their own record
(`ARCHITECTURE.md` §7). If you're adding a route here and reaching for an `hr.*` permission, stop —
either it belongs in the dashboard's `hr/*` modules instead, or it's a genuine exception that needs
the same documented justification Task Assignment has.

None of these permissions carry a `.own`/`.team`/`.all` scope — "own" is already baked into the
routing (there's no id parameter to scope), so a bare permission is enough.

---

## 3. Endpoints by feature

All require a bearer token; 401 without one. Response envelope is the same as the rest of the API:
`{ "data": … }`, paginated lists add `"meta"`.

### Profile (`employee/profile`) — `apps/api/src/modules/employee-self-service/profile/profile.controller.ts`

| Method & path                                                   | Permission                           | Notes                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| GET `/employee/profile`                                         | `employee_self_service.profile.read` | summary / onboarding status                                                                               |
| GET/PUT `/employee/profile/personal-details`                    | `.read` / `.write`                   |                                                                                                           |
| GET/PUT `/employee/profile/address/:type`                       | `.read` / `.write`                   | `:type` = `PERMANENT` \| `CURRENT`                                                                        |
| DELETE `/employee/profile/address/present`                      | `.write`                             | removes the current address override                                                                      |
| GET/PUT `/employee/profile/bank-details`                        | `.read` / `.write`                   |                                                                                                           |
| GET/PUT `/employee/profile/government-ids`                      | `.read` / `.write`                   | Aadhaar / PAN                                                                                             |
| GET/POST `/employee/profile/family`                             | `.read` / `.write`                   | list / add a family member                                                                                |
| PUT/DELETE `/employee/profile/family/:id`                       | `.write`                             |                                                                                                           |
| GET/POST `/employee/profile/experience`                         | `.read` / `.write`                   | prior work experience entries                                                                             |
| PUT/DELETE `/employee/profile/experience/:id`                   | `.write`                             |                                                                                                           |
| GET `/employee/profile/documents`                               | `.read`                              | document checklist + upload status                                                                        |
| PUT/GET/DELETE `/employee/profile/documents/:documentType/file` | `.write` / `.read` / `.write`        | upload, download, remove one required document                                                            |
| POST `/employee/profile/submit`                                 | `.write`                             | finalizes onboarding — `{ missing: string[] }` in the response; empty array = ready to flip to `COMPLETE` |

The Portal's **My Documents** tab (`portal-documents` menu item) reuses `employee_self_service.profile.read` — documents are onboarding data, not a separate module, so there's no `employee_self_service.document.*` permission to look for.

### Leave (`self-service/leave-requests`)

| Method & path                                    | Permission                                   | Notes                              |
| ------------------------------------------------ | -------------------------------------------- | ---------------------------------- |
| GET `/self-service/leave-requests`               | `employee_self_service.leave_request.read`   | the caller's own requests          |
| GET `/self-service/leave-requests/balances`      | same                                         | per-leave-type balance             |
| GET `/self-service/leave-requests/:id`           | same                                         |                                    |
| POST `/self-service/leave-requests`              | `employee_self_service.leave_request.create` |                                    |
| POST `/self-service/leave-requests/:id/cancel`   | same                                         | caller's own, pending request only |
| POST `/self-service/leave-requests/:id/resubmit` | same                                         | after a rejection                  |

Approval is dashboard-only (`hr.leave.approve.*` — see `HR_API.md`); there is no approve route here.

### Attendance (`hr/attendance` — shared controller, own-scope routes)

| Method & path                     | Permission                                           | Notes                                |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| POST `/hr/attendance/check-in`    | `employee_self_service.attendance.punch`             |                                      |
| POST `/hr/attendance/check-out`   | same                                                 |                                      |
| GET `/hr/attendance/mine`         | `employee_self_service.attendance.read`              | the caller's own attendance history  |
| POST `/hr/attendance/corrections` | `employee_self_service.attendance_correction.create` | request a correction to a past punch |

This controller lives under `apps/api/src/modules/hr/`, not `employee-self-service/` — it's the same
table and controller the dashboard uses, with the "mine"/punch routes gated by the self-service
permission instead of a new module. Approve/reject corrections are dashboard-only
(`hr.attendance_correction.approve.*`).

### Tasks (`self-service/tasks`)

| Method & path                         | Permission                                 | Notes                                                   |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| GET `/self-service/tasks`             | `employee_self_service.task.read`          | tasks assigned to the caller                            |
| GET `/self-service/tasks/:id`         | same                                       |                                                         |
| POST `/self-service/tasks`            | `employee_self_service.task.create`        | self-created task (optionally flagged `requestToAdmin`) |
| POST `/self-service/tasks/:id/status` | `employee_self_service.task.update_status` | start/complete/reopen the caller's own task             |

This is a **different capability** from Task Assignment (§5) — "my own tasks" vs. "assigning tasks to
teammates." They intentionally don't share a controller or permission family; see §5 for why.

### Tickets (`self-service/tickets`)

| Method & path                             | Permission                            | Notes                       |
| ----------------------------------------- | ------------------------------------- | --------------------------- |
| GET `/self-service/tickets`               | `employee_self_service.ticket.read`   |                             |
| GET `/self-service/tickets/:id`           | same                                  |                             |
| POST `/self-service/tickets`              | `employee_self_service.ticket.create` |                             |
| PATCH `/self-service/tickets/:id`         | `employee_self_service.ticket.update` |                             |
| POST `/self-service/tickets/:id/comments` | same                                  | add a comment to the thread |

### Expense claims (`self-service/expense-claims`)

| Method & path                          | Permission                                   | Notes |
| -------------------------------------- | -------------------------------------------- | ----- |
| GET `/self-service/expense-claims`     | `employee_self_service.expense_claim.read`   |       |
| GET `/self-service/expense-claims/:id` | same                                         |       |
| POST `/self-service/expense-claims`    | `employee_self_service.expense_claim.create` |       |

Decision (approve/reject) is dashboard-only (`hr.expense_claim.decide.*`).

### Exit requests (`self-service/exit-requests`)

| Method & path                         | Permission                                  | Notes |
| ------------------------------------- | ------------------------------------------- | ----- |
| GET `/self-service/exit-requests`     | `employee_self_service.exit_request.read`   |       |
| GET `/self-service/exit-requests/:id` | same                                        |       |
| POST `/self-service/exit-requests`    | `employee_self_service.exit_request.create` |       |

Decision is dashboard-only (`hr.exit_request.decide.*`).

### Work logs (`self-service/work-logs`)

| Method & path                  | Permission                              | Notes |
| ------------------------------ | --------------------------------------- | ----- |
| GET `/self-service/work-logs`  | `employee_self_service.work_log.read`   |       |
| POST `/self-service/work-logs` | `employee_self_service.work_log.create` |       |

---

## 4. The portal sidebar for all of this

Every route above has a matching `MenuItem` under the `portal` root
(`packages/database/prisma/menu/catalog.ts`), each gated by exactly the `.read` permission for that
feature. `DynamicSidebar` renders the portal shell with `onlyRootCode="portal"` — see
[`MENU_NAVIGATION_API.md`](MENU_NAVIGATION_API.md) for how that filtering works and how to add a new
tab. The "Go to HR/Admin" button some screenshots/old docs may still mention **no longer exists** —
the portal and dashboard are fully separate shells with no cross-navigation button; a user with both
employee and HR permissions still only sees the portal sidebar while in `/portal/...`.

---

## 5. Task Assignment — the one `hr.*` permission in the portal

`/portal/task-assignment`, gated by `hr.task.write.team` (+ `hr.task.read.team` for the list to
actually render — see below), is the **documented exception** to §2's namespace rule
(`ARCHITECTURE.md` §7). It exists for a Team Lead who needs to assign/reassign/approve tasks for their
**team**, which is not self-service data by any definition — it's exactly the same capability and the
exact same API routes the HR dashboard's Task Assignment page uses (`hr/tasks`, documented in
`HR_API.md` / `HR_TASK_ASSIGNMENT.md`), just reached from the portal shell:

- The page reuses the dashboard's `TasksView` component as-is (`apps/ui/src/features/hr/tasks/`) — no
  duplicated business logic, no separate "portal version" of the task list.
- Both `hr.task.read.team` **and** `hr.task.write.team` must be granted together: the component gates
  its _list_ on the read permission and its _actions_ on the write permission; granting only write
  shows the tab but an empty "you don't have access" state.
- Not granted to the default "Team Lead" role out of the box — a deliberate policy decision
  (`packages/database/prisma/permissions/default-roles.ts`: Team Lead is read-only by default). An
  administrator opts in per-organization via Settings → Roles → Menu access.
- The API enforces team scope independently via `@TeamScoped()` on every route in
  `apps/api/src/modules/hr/tasks/tasks.repository.ts` — a Team Lead cannot act on another team's task
  by changing an id in the request, regardless of what the portal sidebar shows.

---

## 6. Testing checklist specific to this surface

1. **Identity leakage**: none of these endpoints take an employee id. Confirm a request body/query
   with a stray `employeeId`/`userId` field is either ignored or rejected (400, unknown-field DTO
   validation) — it must never let caller A act on employee B's record.
2. **Onboarding gate**: most of these routes are only reachable once `onboardingStatus === COMPLETE`
   (`apps/ui/src/app/(employee-portal)/layout.tsx`) — verify an incomplete profile is confined to the
   onboarding wizard, not the portal shell.
3. **Cross-check with the dashboard**: for any entity that exists on both sides (leave, attendance,
   tasks, tickets, expense claims, exit requests), confirm a self-service create is visible to HR on
   the dashboard side and vice versa — they're the same rows, not a shadow copy.
4. **Task Assignment specifically**: confirm granting only `hr.task.write.team` (without `.read.team`)
   reproduces the "tab visible, list empty/errors" state described in §5 — this is expected, not a bug,
   but worth knowing so it isn't reported as one.
5. See [`MENU_NAVIGATION_API.md`](MENU_NAVIGATION_API.md) §6 for the general "hidden tab ≠ secure"
   testing method and the sign-out/sign-in-again requirement after a permission change.
