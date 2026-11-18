# Timesheets — how to test it by hand

**Owner:** repository maintainers.
**Last verified:** 2026-11-17 (every scenario below is covered by an automated test or was clicked through in a
real browser; the labels in the Settings screens may differ slightly from the words used here).
**Read first:** `TIMESHEET.md` (what the module does and why). This file is only the test script.

## 1. Prepare

> Use a **development** database you can lose. The migrations are additive, but take a dump first.

```bash
# 1. back up (adjust the container/user to your docker-compose)
docker exec <postgres-container> pg_dump -U texawave -d texawave_erp -Fc > texawave_erp_before_timesheets.dump

# 2. apply the five timesheet migrations, then sync permissions and menu
pnpm --filter database migrate:deploy
pnpm --filter database permissions:sync
pnpm --filter database menu:sync

# 3. start the app
pnpm --filter api dev      # http://localhost:3000
pnpm --filter ui dev       # http://localhost:3001
```

If `migrate:deploy` stops with **P3009** on `20261023090000_create_projects_module_tables`, that database already had
those tables: run `pnpm --filter database exec prisma migrate resolve --applied 20261023090000_create_projects_module_tables`
and deploy again (that migration's header says an existing database must not run it).

Sign in as the seeded Super Admin (`admin@texawave.com` / `ChangeMe123!`, local dev only).

## 2. Accounts you need

`permissions:sync` never gives anyone a permission, so grant them in **Settings → Roles** and attach the role to the
user. Create these people (Employees, then a login for each) and set **Reports to** on the employee as shown:

| Person       | Reports to  | Role / permissions                                                                                   |
| ------------ | ----------- | ---------------------------------------------------------------------------------------------------- |
| **Asha**     | **Manager** | the default **Employee** role, plus `projects.timer.write` (My Work needs it)                        |
| **Ben**      | nobody      | the default **Employee** role, plus `projects.timer.write` (no manager: goes to HR alone)            |
| **Manager**  | nobody      | Employee role + `hr.timesheet.read.own` + `hr.timesheet.approve.own` (the reporting-manager level)   |
| **HR**       | nobody      | the default **HR Manager** role (has read, approve and export at `.all`)                             |
| **Outsider** | nobody      | Employee role + `hr.timesheet.read.own` + `hr.timesheet.approve.own`, and **nobody reports to them** |

Asha and Ben also need some work: create a project, add them as members, and assign each a task or two.

## 3. The scenarios

Each line is _do this → you should see this_.

### A. The employee's day (sign in as Asha)

1. **Check in** (Attendance → Check In / Out), open **My Work**, **Start** a task, wait a minute, **Pause** it.
   → **My Timesheet** shows today with one row, the session times in IST and the minutes. The day chip says **Draft**.
2. **Add custom activity**: Internal meeting, today, 14:00–15:00 → the row shows **1h**; the day total adds up.
   Try one that overlaps → refused with a clear message. Try a future time → refused.
3. Go to a past date, add an activity → it asks for a **reason for the late entry**, and the row is marked "Late entry".
4. **Submit day** (confirm). → chip **Waiting for manager approval**; Edit/Delete disappear; **Start** on any task for
   that day is refused ("already submitted").
5. Add work to a **different** task on a submitted day (My Work → Start another task, or a manual time entry for that
   date) → refused. This is the fix for "a submitted day gaining a draft row".

### B. Two-level approval (Manager, then HR)

6. Sign in as **Manager** → **Team Timesheets**. **Waiting for me** shows Asha's day; the cards on top show the counts.
   **Review** opens it: rows, sessions, HR's attendance status, and any warning flags.
7. **Approve (first approval)** with a note. → the day stays **Submitted**, now **Waiting for HR approval**.
   Manager can no longer decide it (the button is gone). Asha gets a notification.
8. Sign in as **HR** → Team Timesheets (or HR → Timesheets). The day is in **Waiting for me** → **Approve**.
   → **Approved**. Asha is notified. Asha's day is locked.
9. Repeat with a new day, but at step 7 click **Return to employee**: a reason is **required**. → Asha sees
   **Returned** and the reason in a banner, can edit it, and **Submit day** again — the review starts from the first step.

### C. Without a manager, and HR override

10. Ben submits a day. → **Waiting for HR approval** straight away. **Manager** and **Outsider** do not see it. HR approves it.
11. Asha submits a day and the Manager does nothing. HR opens it and approves directly → **Approved**
    (an _override_; the audit log records it).

### D. HR reopens, and corrects a forgotten timer

12. As HR open an **Approved** day → **Reopen this day** with a reason → the day is **Returned** for the employee.
13. A forgotten timer is closed by the system with **0 minutes** and flagged. To make one quickly, in psql:

    ```sql
    UPDATE projects.project_time_entries
       SET ended_at = started_at, duration_minutes = 0,
           review_state = 'STALE_UNRESOLVED', closed_reason = 'STALE'
     WHERE id = <the id of a closed session of Asha>;
    ```

    The day shows the flag **"A timer was left running…"**. As HR open the day → **Set the real end time**
    (a time after the start, not in the future), a reason → the minutes now count, the flag clears, Asha is notified.
    Try an end before the start, a future time, or one that overlaps another session → each is refused.
    Manager (not HR) never sees the button.

### E. Attendance flags

14. Work on a day HR marked **Absent** → flag "work on a day marked absent". On a **holiday** or **weekly off** → an
    information flag. After a day is submitted, change that day's attendance in HR → the reviewer sees
    "attendance has changed since it was submitted" (the submitted hours do not change).

### F. Reports and CSV (HR)

15. **Team Timesheets → Report**: pick a range (up to 62 days). One line per employee: task time, other, total, and how
    many days are Not submitted / Submitted / Approved / Returned. **CSV by employee** and **CSV by day** download files
    that open in Excel. A name starting with `=` appears as text, never as a formula.
16. Sign in as **Manager**: the Report tab works for their own reports but there are **no CSV buttons** (no export permission).
17. **Team Timesheets → Week**: the current week, Monday to Sunday. Each person with work has a row; each cell shows hours
    and a state (Draft grey, Submitted blue — "Waiting for manager" or "Waiting for HR" —, Approved green, Returned amber).
    Row totals and the team-total row add up. Days after today are dashes. Use the arrows, **This week**, or the date field
    to move. Click a submitted/approved/returned cell → the review dialog opens; a Draft cell is not clickable. Manager
    sees only the people who report to them.

### G. Things that must be refused

18. **Outsider** opens `/portal/team-timesheets` → empty lists; trying a direct URL to Asha's day gives "not found".
19. Nobody can approve **their own** day, even HR. HR who is also an employee cannot approve or reopen their own day.
20. A person without the permission cannot open Team Timesheets at all (no sidebar link; the API says 403).

## 4. Automated checks (run these too)

```bash
pnpm --filter api test                              # unit tests
pnpm --filter api test:e2e                          # needs a DISPOSABLE db + redis index != 0, see apps/api/test/README.md
pnpm --filter ui exec playwright test e2e/employee-timesheet.spec.ts e2e/team-timesheets.spec.ts   # api + ui running, seeded db
pnpm --filter database permissions:check && pnpm --filter database menu:check
```

The timesheet suites are `timesheets-lifecycle`, `timesheets-custom-activities`, `timesheets-attendance` and
`timesheets-review` under `apps/api/test/`.

## 5. Known limits (do not report these as bugs)

- Approval **delegation** (a manager handing approval to someone while away) is not built; HR's override covers it.
- A timer closed across **midnight into an already-submitted next day** is still allowed to close (it must always be
  possible to stop a timer); that one case can leave the next day with a draft row.
- Review lists show the last **92 days** unless you give a date range; reports are capped at **62 days** and 50,000 rows.
- An **auto-checkout** cannot be told apart from a real punch in HR's data, so it is not flagged.
- `logged_hours` on a task can drift by 0.01 h from rounding each close separately (pre-existing).
- The legacy manual time-entry endpoint still lets any holder of `projects.timer.write` log time on a task that is not
  assigned to them (pre-existing; open question for the product owner).

## 6. Undo

Restore the dump from step 1 (`pg_restore --clean`). The migrations are not reversible by SQL. Test rows you created
(users, projects, timesheets) stay in the database; audit rows can never be deleted by design.
