# HR → Recruitment → Promotion Letter — Guide for UI and QA

**Status (2026-10-09):** backend built and tested (`apps/api/src/modules/hr/promotion-letters/`,
migration `20261009090000_add_hr_promotion_letters`). **Basic UI built** — the "Promotion letter"
tab on HR → Recruitment (§3.0 says exactly what exists).
The API contract (routes, permissions, error codes) is in [HR_API.md](HR_API.md) §2 "Recruitment —
promotion letters"; this file does not repeat it, it explains how to use and test it.

---

## 1. What it is

A fourth tab on HR → Recruitment, next to Interview schedule, Offer letter and Revision letter. HR
issues a promotion letter to an **existing employee**: a new designation plus the new salary
components. It behaves like a revision letter, with two differences:

1. **Designation comes from the master list** (`hr.designations`), not free text. The dropdown is
   the master; a missing designation is added there first.
2. **Salary history:** when an employee is selected, the UI can expand a panel listing that
   employee's past revision and promotion letters, so HR sees the salary trail before
   issuing a new one.

## 2. End-to-end flow

```
Recruitment → Promotion letter tab
  ├── Employees (GET /hr/employees, search + pagination, scope-filtered by the API)
  │     └── click an employee ▸ salary history expands underneath
  │           (GET /hr/promotion-letters/salary-history/:employeeId — fetched on first expand)
  │           current designation + past revisions/promotions, newest effective date first
  │     └── "Promotion letter" button → form dialog
  │           1. Previous designation (read-only: the employee's current one)
  │           2. New designation (GET /master-data/designations, active ones only)
  │                └── optional "+ Add designation" (POST /master-data/designations)
  │           3. Location, letter date, effective date
  │           4. Monthly/annual salary → split 35/15/30/20 into Basic / DA / HRA / CA (editable)
  │           5. Signatory → Save → POST /hr/promotion-letters → 201, TW/HR/PRO/{FY}/NNN
  └── Promotion letters (GET /hr/promotion-letters) → View / Edit (GET / PATCH …/:id)
```

What saving **does not** do: it does not change the employee's designation or salary on the
employee record (same as revision letters; open decision). There is no delete and no approval step.

---

## 3. UI / frontend guide

### 3.0 What is built (status 2026-10-09)

A deliberately simple first version in the existing Recruitment feature — no new route or menu row.

| File (`apps/ui/src/features/hr/recruitment/`) | What it does                                                                                     |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `components/RecruitmentView.tsx`              | Fourth tab "Promotion letter" (id `promotions`), shown with any `hr.promotion_letter.read.*`     |
| `components/PromotionsPanel.tsx`              | Employees list with expandable salary history + "Promotion letter" button; issued-letters list   |
| `components/SalaryHistory.tsx`                | The expanded "sub-branch": current designation, hidden-revisions note, history table             |
| `components/PromotionForm.tsx`                | Create/edit form, designation dropdown, inline "+ Add designation"                               |
| `api.ts`, `hooks.ts`, `types.ts`              | `/hr/promotion-letters*` calls; queries under the `hr-recruitment` key, so every write refreshes |
| `permissions.ts`, `schema.ts`                 | `promotionRead/Write`, `designationRead/Write`; zod `promotionFormSchema`                        |

Reused, not rebuilt: ui-kit `DataTable`, `Dialog`, `Select`, `FormField`, `StatusBadge`; the
Recruitment `salary.ts` split helpers; `useDesignations` / `useCreateDesignation` from
`features/designations/hooks`.

### 3.1 Screens

**Employees** — the same scope-filtered, searchable, paginated employee list as the Revision tab,
rendered as a disclosure list (ui-kit `DataTable` has no expandable rows). Each row is a button
(`aria-expanded`, chevron) showing name, code, designation and team. Expanding it mounts the
**salary history**: "Current designation: …", then a table — Type badge (`Promotion` green /
`Revision` brand), document no., effective date, designation (`previous → new` for promotions),
Basic / DA / HRA / CA, gross monthly. When `revisionsIncluded` is `false`: "Revision letters are
hidden — you do not have access to them." Empty: "No previous revision or promotion letters." One
employee is expanded at a time; changing page or search collapses it.

**Promotion letters** — document no., employee (name + code), `previous → new` designation,
effective date, gross monthly, status, View / Edit. Pagination, newest first.

**Create / edit form** (dialog)

| Field                  | Control                                                           | Default (API applies it if omitted) |
| :--------------------- | :---------------------------------------------------------------- | :---------------------------------- |
| Employee               | Fixed by the row clicked (immutable on edit)                      | —                                   |
| Previous designation   | Read-only: employee's current designation / the letter's snapshot | —                                   |
| New designation        | `Select` of **active** designations                               | — (required)                        |
| Location               | Text                                                              | `Chennai`                           |
| Letter date            | Date                                                              | today                               |
| Effective date         | Date                                                              | 1st of next month                   |
| Monthly / annual       | Amount + toggle → split 35/15/30/20 into the four components      | —                                   |
| Basic / DA / HRA / CA  | Number, ≥ 0, 2 dp                                                 | `0`                                 |
| Gross monthly / annual | Read-only, computed live (sum; ×12)                               | —                                   |
| Signatory name / desg. | Text                                                              | `Amanullah Khan` / `Co-Founder`     |

- **Designation list:** `GET /master-data/designations?limit=100`, inactive rows filtered out in
  the browser (the shared `QueryDesignationsInput` type has no `isActive` yet). More than 100
  designations would need that filter or a search box.
- **Edit:** the designation is sent only if changed, so a letter whose designation was deactivated
  later can still be edited (it shows as "… (inactive)").
- **+ Add designation** (`master.designation.write` only): name + code, both typed by the user
  (the code is never filled in from the name; it is upper-cased before sending, e.g. `team_lead` →
  `TEAM_LEAD`). On success the new designation is selected. A duplicate code/name shows the API's
  message inline.
- **Known shared-component issue:** the ui-kit `Dialog` renders top-left and at `max-w-lg` (the
  `max-w-3xl` override does not win). It affects every Recruitment dialog, not just this one; fix
  it in `packages/ui-kit` in a separate PR.

### 3.2 Permission rules (UI visibility only — the API is authoritative)

| Action                  | Needs                                                                     |
| :---------------------- | :------------------------------------------------------------------------ |
| See the tab, list, view | any of `hr.promotion_letter.read.{own,team,all}`                          |
| New / Edit              | `hr.promotion_letter.write.team` or `.all` (`.own` is refused by the API) |
| Revisions in history    | also `hr.revision_letter.read.*` (otherwise the API leaves them out)      |
| Designation dropdown    | `master.designation.read`                                                 |
| "+ Add designation"     | `master.designation.write`                                                |

### 3.3 Errors shown to the user

| API response              | Message                                                                              |
| :------------------------ | :----------------------------------------------------------------------------------- |
| 422 `INVALID_DESIGNATION` | "That designation is inactive or no longer exists. Pick another." (refetch the list) |
| 422 `INVALID_EMPLOYEE`    | "This employee isn't in your teams or no longer exists."                             |
| 404 on history / letter   | "Not found or outside your teams."                                                   |
| 403                       | "You don't have access to promotion letters."                                        |

Loading, error-with-retry and empty states, spinners on buttons and the responsive and
accessibility rules are the same as the other Recruitment tabs and Payroll
(`PAYROLL_AND_COMPLIANCE.md` §5.0).

---

## 4. QA guide

### 4.1 Automated suites

- **Unit:** `apps/api/src/modules/hr/promotion-letters/*.spec.ts` — document numbering, history
  ordering, defaults, `.own` write refused, revision scope dropped (not an error) without permission.
- **API e2e:** `apps/api/test/hr-promotion-letters.e2e-spec.ts` — 401/403, issuing and snapshots,
  concurrent numbering, designation validation, team and org isolation, edit rules, audit without
  amounts, salary history with and without revision access, DB CHECK constraints.
- **Browser e2e (Playwright, mocked API):** `apps/ui/e2e/hr-recruitment.spec.ts` — six promotion
  tests (history loads only on expand and keeps the API order; hidden-revisions note; designation
  required, only active ones offered, exact POST body with `designationId`; `INVALID_DESIGNATION`
  shown on the field; "+ Add designation" body and auto-select; read-only user has no Issue/Edit)
  plus the Promotion tab in the 375px no-horizontal-scroll check.

### 4.2 API test cases

| Test case     | Scenario                                                                           | Expected                                                                                  |
| :------------ | :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **TC-PRO-01** | Issue with employee + active designation + components 40000/15000/30000/20000      | 201; `documentNo` `TW/HR/PRO/26-27/NNN`; gross 105000.00 / 1260000.00; status `GENERATED` |
| **TC-PRO-02** | Same, omitting optional fields                                                     | Location Chennai, letter date today, effective 1st of next month, signatory defaults      |
| **TC-PRO-03** | Check `previousDesignation`                                                        | Employee's designation at issue time; the employee record is unchanged                    |
| **TC-PRO-04** | Inactive designation / another org's designation / unknown id                      | 422 `INVALID_DESIGNATION`                                                                 |
| **TC-PRO-05** | Free-text `designation` in the body, or no `designationId`                         | 400                                                                                       |
| **TC-PRO-06** | Team lead (`.team`) issues for an employee in another team / admin for another org | 422 `INVALID_EMPLOYEE`                                                                    |
| **TC-PRO-07** | User with only `write.own`                                                         | 403                                                                                       |
| **TC-PRO-08** | Five issues at once                                                                | Five distinct document numbers                                                            |
| **TC-PRO-09** | PATCH a new `designationId`                                                        | `designation` updated; `previousDesignation` and `documentNo` unchanged                   |
| **TC-PRO-10** | PATCH `employeeId`                                                                 | 400                                                                                       |
| **TC-PRO-11** | Team lead reads / edits a letter of another team; other org reads it               | 404                                                                                       |
| **TC-PRO-12** | Salary history as HR with revision read                                            | Revisions + promotions, newest effective date first; `revisionsIncluded: true`            |
| **TC-PRO-13** | Salary history without `hr.revision_letter.read`                                   | Only promotions; `revisionsIncluded: false`; still 200                                    |
| **TC-PRO-14** | Salary history for an employee outside scope / another org                         | 404                                                                                       |
| **TC-PRO-15** | `GET /audit/logs?entityType=promotion_letter` after create + edit of HRA           | `create` and `update` rows; `changedFields` contains `hra`; no amounts anywhere           |
| **TC-PRO-16** | Rename the designation in the master after issuing                                 | Issued letter keeps the old name                                                          |

### 4.3 UI test cases (manual or Playwright)

"Auto" = covered by `hr-recruitment.spec.ts`; the rest are manual.

| Test case        | Steps                                                           | Expected                                                                                    | Auto |
| :--------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------ | :--: |
| **TC-PRO-UI-01** | User without any promotion permission opens Recruitment         | No "Promotion letter" tab                                                                   |      |
| **TC-PRO-UI-02** | Promotion tab → click an employee                               | Row expands (chevron turns); current designation; past letters newest first, typed by badge |  ✔   |
| **TC-PRO-UI-03** | Same, as a user without `hr.revision_letter.read.*`             | Only promotions + "Revision letters are hidden — you do not have access to them."           |  ✔   |
| **TC-PRO-UI-04** | Expand an employee with no letters                              | "No previous revision or promotion letters."                                                |      |
| **TC-PRO-UI-05** | "Promotion letter" on a row → open the New designation dropdown | Previous designation prefilled read-only; only active designations listed                   |  ✔   |
| **TC-PRO-UI-06** | "+ Add designation", type "Tech Architect", Add                 | Code stays empty until typed; empty code refused, no request; created and selected          |  ✔   |
| **TC-PRO-UI-07** | Type a monthly salary, then switch to Annual                    | Components split 35/15/30/20; gross monthly and annual update live                          |      |
| **TC-PRO-UI-08** | Issue without a designation                                     | Designation field marked invalid; no request sent                                           |  ✔   |
| **TC-PRO-UI-09** | Designation deactivated (in Admin → Designations) before saving | "That designation is inactive or no longer exists. Pick another."; dropdown refreshes       |  ✔   |
| **TC-PRO-UI-10** | User with only promotion read (`.team`)                         | Own-team letters listed; View only — no "Promotion letter" or Edit buttons                  |  ✔   |
| **TC-PRO-UI-11** | Edit a letter, change only HRA, save                            | No designation sent; document number unchanged; history of that employee shows the new HRA  |      |
| **TC-PRO-UI-12** | Issue a letter while that employee's history is expanded        | History refreshes and shows the new promotion first (same effective date or newer)          |      |
| **TC-PRO-UI-13** | Phone width (375px), employee expanded                          | No page-level sideways scroll; the history table scrolls inside its own frame               |  ✔   |
| **TC-PRO-UI-14** | Keyboard only: Tab to an employee row, Enter / Space            | Toggles the history; screen reader announces "Show/Hide salary history of …" and expanded   |      |

### 4.4 How to run

```bash
# Unit
pnpm --filter api exec vitest run src/modules/hr/promotion-letters

# API e2e — disposable DB + non-zero Redis index (apps/api/test/README.md)
# PowerShell (bash: export DATABASE_URL=... / export REDIS_URL=...)
$env:DATABASE_URL="postgresql://texawave:texawave@localhost:5432/texawave_erp_test?schema=public"
$env:REDIS_URL="redis://localhost:6379/5"
pnpm --filter @texawave-erp/database exec prisma migrate deploy
pnpm --filter api test:e2e test/hr-promotion-letters.e2e-spec.ts

# Browser e2e — the API is mocked, but the UI dev server must be running on :3001
pnpm --filter ui exec playwright install chromium   # once; or set PLAYWRIGHT_USE_SYSTEM_CHROME=1
pnpm --filter ui test:e2e e2e/hr-recruitment.spec.ts
```

**Manual testing on the dev DB** needs the migration applied and the new permissions synced:
`pnpm --filter database exec prisma migrate dev`, then
`pnpm --filter @texawave-erp/database permissions:sync`. The HR Manager role gets
`hr.promotion_letter.{read,write}.all` by default; the "salary history" revisions also need
`hr.revision_letter.read.*`. At least one active designation must exist besides the employee's current one.

## 5. Open decisions

- Should issuing a promotion update the employee's designation (and salary) on the employee record?
  Today it doesn't, matching revision letters.
- PDF / printable letter, signature and seal images: not built (same as revision letters).
