# HR → Recruitment → Promotion Letter — Guide for UI and QA

**Status (2026-10-09):** backend built and tested (`apps/api/src/modules/hr/promotion-letters/`,
migration `20261009090000_add_hr_promotion_letters`). **UI not built yet** — §3 is the spec for it.
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
  └── Letters list (GET /hr/promotion-letters)
        └── "New promotion letter"
              1. Pick employee (EmployeePicker, scope-filtered by the API)
              2. ▸ Salary history expands under the employee
                   (GET /hr/promotion-letters/salary-history/:employeeId)
                   shows current designation + past revisions/promotions, newest first
              3. Pick new designation (GET /master-data/designations?isActive=true)
                   └── optional "+ Add designation" (POST /master-data/designations,
                       only with master.designation.write)
              4. Dates, location, Basic / DA / HRA / CA, signatory (prefilled defaults)
              5. Save → POST /hr/promotion-letters → 201, document number TW/HR/PRO/{FY}/NNN
        └── Row → View / Edit (GET / PATCH /hr/promotion-letters/:id)
```

What saving **does not** do: it does not change the employee's designation or salary on the
employee record (same as revision letters; open decision). There is no delete and no approval step.

---

## 3. UI / frontend guide

### 3.1 Where the code goes

Follow the existing Revision letter tab — same feature folder, no new route:

- `apps/ui/src/features/hr/recruitment/components/RecruitmentView.tsx` — add tab id `"promotions"`,
  label "Promotion letter", shown when the user holds any of `hr.promotion_letter.read.{own,team,all}`.
- `apps/ui/src/features/hr/recruitment/components/PromotionsPanel.tsx` — new, modelled on
  `RevisionsPanel.tsx`.
- `api.ts`, `hooks.ts`, `types.ts`, `permissions.ts` in the same feature — add the promotion calls,
  types and permission helpers next to the revision ones.
- Reuse: `EmployeePicker` (`apps/ui/src/components/widgets/EmployeePicker.tsx`), ui-kit `Tabs`,
  `Dialog`, form primitives. Don't build a local dropdown or picker.

### 3.2 Screens

**Letters list** — columns: document no., employee (code + name), previous → new designation,
effective date, gross monthly, letter date. `?employeeId` filter via the employee picker,
pagination, newest first.

**Create / edit form**

| Field                  | Control                                                 | Default (API applies it if omitted) |
| :--------------------- | :------------------------------------------------------ | :---------------------------------- |
| Employee               | `EmployeePicker` (create only — immutable on edit)      | —                                   |
| New designation        | Select fed by `/master-data/designations?isActive=true` | —                                   |
| Location               | Text                                                    | `Chennai`                           |
| Letter date            | Date                                                    | today                               |
| Effective date         | Date                                                    | 1st of next month                   |
| Basic / DA / HRA / CA  | Number, ≥ 0, 2 dp                                       | `0`                                 |
| Gross monthly / annual | Read-only, computed live (sum; ×12)                     | —                                   |
| Signatory name / desg. | Text                                                    | `Amanullah Khan` / `Co-Founder`     |

- Show the employee's **current designation** (from the salary-history response) as "Previous
  designation", read-only. Don't offer the current designation as the "new" one by default.
- **Salary history panel** (collapsible, under the employee field, also openable from a list row):
  one row per entry — badge `Revision` / `Promotion`, document no., effective date,
  designation (for a promotion: previous → new), Basic / DA / HRA / CA, gross monthly.
  When `revisionsIncluded` is `false`, show a note: "Revision letters are hidden — you don't have
  access to them." Empty: "No previous revision or promotion letters."
- **Add designation**: only if the user has `master.designation.write`. After creating it,
  refetch the list and select the new one.

### 3.3 Permission rules (UI visibility only — the API is authoritative)

| Action                  | Needs                                                                     |
| :---------------------- | :------------------------------------------------------------------------ |
| See the tab, list, view | any of `hr.promotion_letter.read.{own,team,all}`                          |
| New / Edit              | `hr.promotion_letter.write.team` or `.all` (`.own` is refused by the API) |
| Revisions in history    | also `hr.revision_letter.read.*` (otherwise the API leaves them out)      |
| Designation dropdown    | `master.designation.read`                                                 |
| "+ Add designation"     | `master.designation.write`                                                |

### 3.4 Errors to map to plain English

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
- **Browser e2e:** `apps/ui/e2e/hr-recruitment.spec.ts` — to be extended when the UI is built.

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

### 4.3 UI test cases (once the tab is built)

| Test case        | Steps                                                         | Expected                                                                            |
| :--------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| **TC-PRO-UI-01** | User without any promotion permission opens Recruitment       | No "Promotion letter" tab                                                           |
| **TC-PRO-UI-02** | Pick an employee, expand Salary history                       | Current designation shown; past letters newest first with Revision/Promotion badges |
| **TC-PRO-UI-03** | Same, as a user without revision read                         | Only promotions + "Revision letters are hidden" note                                |
| **TC-PRO-UI-04** | Employee with no letters                                      | "No previous revision or promotion letters."                                        |
| **TC-PRO-UI-05** | Open the designation dropdown                                 | Only active designations                                                            |
| **TC-PRO-UI-06** | "+ Add designation" with / without `master.designation.write` | Creates and auto-selects / button not shown                                         |
| **TC-PRO-UI-07** | Type components                                               | Gross monthly and annual update live                                                |
| **TC-PRO-UI-08** | Save with no employee or no designation                       | Inline errors; no request                                                           |
| **TC-PRO-UI-09** | Designation deactivated by someone else before save           | `INVALID_DESIGNATION` message; list refetched                                       |
| **TC-PRO-UI-10** | Team lead (read-only `.team`) opens the tab                   | List of own-team letters; no New / Edit buttons                                     |
| **TC-PRO-UI-11** | Edit a letter                                                 | Employee field locked; document number unchanged after save                         |
| **TC-PRO-UI-12** | Phone width (375px) and keyboard-only                         | No page-level sideways scroll; tab bar works with Arrow / Home / End                |

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
