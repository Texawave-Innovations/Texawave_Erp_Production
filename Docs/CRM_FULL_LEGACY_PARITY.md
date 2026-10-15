# CRM Full Legacy Parity Audit

**Status:** Audit + phased implementation plan complete (§1–§6 below). **Phase 0
(Account-360 foundation) is now implemented** at the data/API layer — see §8 for exact
evidence, test results, and what's still deliberately deferred. **Phase 1A
(Account-360 UI) is now implemented** on top of that — see §9. Phases 1 (status-queue
UI)/2–8 remain unimplemented.
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP` (Vite/React, Firebase RTDB).
**Production source:** `D:\New folder\Texawave_Erp_Production`, branch `feature/crm`.
**Methodology:** every legacy screen's actual route/component/service was read directly
(not inferred from its menu label), cited with file:line evidence, then compared against
the current new-repo routes/UI/API/Prisma schema/permissions. Six parallel audits covered:
Dashboard/Overall Data/Accounts Mining Sheet/Global Search; the six lead/account
status-queue screens; WhatsApp/LinkedIn/Email; Target/Recycle Bin/Calendar/
Notifications/Bulk Import; and Accounts (list/detail/nav). The already-implemented core
entities (Contacts, Leads, Pipeline/Opportunities, Products, Quotations+print) are
reported from this session's own implementation work and the existing
`Docs/CRM_LEGACY_PARITY.md` / `Docs/CRM_PRODUCTS_LEGACY_PARITY.md` /
`Docs/CRM_QUOTES_LEGACY_PARITY.md` / `Docs/CRM_QUOTES_PRINT_PARITY.md` audits, not
re-read line-by-line in this pass — flagged explicitly where that matters.

Evidence labels used throughout: **Confirmed** (read directly in source, cited),
**Absent (verified)** (actively checked for, not found), **Inference** (reasonable
conclusion not directly cited — used sparingly, always labeled).

---

## 1. Summary parity matrix

| #   | Legacy feature        | Legacy route                                 | New ERP evidence                                                                                          | Status                                | Exact gap                                                                                                                                                                                     |
| --- | --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dashboard             | `/crm/dashboard` (`CrmDashboard.tsx`)        | none                                                                                                      | **MISSING**                           | No route, no widgets, no aggregation of any kind. §3.1                                                                                                                                        |
| 2   | Overall Data          | `/crm/overall-data` (`OverallData.tsx`)      | none                                                                                                      | **MISSING**                           | No route; depends on entities that don't exist yet (Meetings/Activities/FollowUps). §3.1                                                                                                      |
| 3   | Accounts Mining Sheet | `/crm/accounts-mining-sheet`                 | none                                                                                                      | **MISSING**                           | No route, no dataset, no promote-to-lead workflow. §3.1                                                                                                                                       |
| 4   | Cold Calling Status   | `/crm/cold-calling-status`                   | none                                                                                                      | **MISSING**                           | No route, no dataset (independent import-staging table). §3.2                                                                                                                                 |
| 5   | Leads                 | `/crm/leads` (`Leads.tsx`)                   | `apps/ui/src/app/(dashboard)/crm/leads/`, `apps/api/src/modules/crm/leads/`                               | **PARTIAL**                           | Core CRUD + convert COMPLETE (prior audit/implementation); legacy's `LeadDetail.tsx` 360-style detail page not verified in this pass. §2                                                      |
| 6   | Yet to Happen         | `/crm/yet-to-happen`                         | none                                                                                                      | **MISSING**                           | No route; needs Task/FollowUp/Meeting entities that don't exist yet. §3.2                                                                                                                     |
| 7   | Call Back-Send Info   | `/crm/call-back-send-info`                   | none                                                                                                      | **MISSING**                           | Shared `AccountStatusQueue` component; needs `Account.statusTag` schema addition. §3.2                                                                                                        |
| 8   | Interested            | `/crm/interested`                            | none                                                                                                      | **MISSING**                           | Same shared component/schema gap as #7. §3.2                                                                                                                                                  |
| 9   | Keep in Touch         | `/crm/keep-in-touch`                         | none                                                                                                      | **MISSING**                           | Same shared component/schema gap as #7. §3.2                                                                                                                                                  |
| 10  | Not Interested        | `/crm/not-interested`                        | none                                                                                                      | **MISSING**                           | Same shared component/schema gap as #7. §3.2                                                                                                                                                  |
| 11  | WhatsApp              | `/crm/whatsapp`                              | `ContactForm.tsx` has a plain WhatsApp **text field** only                                                | **MISSING**                           | No `ChannelActivityQueue` equivalent, no `CrmActivity` entity, no `wa.me` deep-link UI. §3.3                                                                                                  |
| 12  | LinkedIn              | `/crm/linkedin`                              | none                                                                                                      | **MISSING**                           | Zero matches anywhere in real new-repo code. §3.3                                                                                                                                             |
| 13  | Email                 | `/crm/email`                                 | none                                                                                                      | **MISSING**                           | No `CrmActivity`-based logging/mailto queue (a Sales-module quotation-email dialog is unrelated). §3.3                                                                                        |
| 14  | Accounts              | `/crm/accounts`                              | `AccountCombobox.tsx`, minimal `Account` Prisma model, `accounts` API (list/get/create/update, no delete) | **PARTIAL**                           | Prisma model has 6 of ~35 legacy fields; API has no delete/status endpoints; **no list page, no detail page, no form page, no route exists in `apps/ui`** — only a name-picker dropdown. §2.1 |
| 15  | Pipeline              | `/crm/pipeline` (`Pipeline.tsx`)             | `apps/ui/src/app/(dashboard)/crm/pipeline/`, full `opportunities`/`pipeline-stages` modules               | **PARTIAL**                           | Core CRUD, stage history, products, quotes-tab COMPLETE (prior audit/implementation); legacy `DealDetail.tsx`'s full tab set not re-verified in this pass. §2                                 |
| 16  | Contacts              | `/crm/contacts` (`Contacts.tsx`)             | `apps/ui/src/app/(dashboard)/crm/contacts/`, `apps/api/src/modules/crm/contacts/`                         | **COMPLETE** (core)                   | Prior audit/implementation; e2e-tested (`crm-contacts.e2e-spec.ts`). §2                                                                                                                       |
| 17  | Products              | `/crm/products` (`Products.tsx`)             | `apps/ui/src/app/(dashboard)/crm/products/`, `apps/api/src/modules/crm/products/`                         | **COMPLETE** (core)                   | Prior audit/implementation; e2e-tested. §2                                                                                                                                                    |
| 18  | Quotation             | `/crm/quotes` (`Quotes.tsx`/`QuoteForm.tsx`) | `apps/ui/src/app/(dashboard)/crm/quotes/`, quotation module, browser-native print                         | **COMPLETE** (core + print)           | Prior audit/implementation; e2e-tested; print adapted with the IGST-mislabel/fake-bank-details fixes already applied. §2                                                                      |
| 19  | Target                | `/crm/quotas` (`Quotas.tsx`)                 | none                                                                                                      | **MISSING**                           | No route, no `Quota` model, no attainment-computation logic. §3.4                                                                                                                             |
| 20  | Recycle Bin           | `/crm/recycle-bin` (admin-only)              | `deletedAt` soft-delete column already on Account/Contact/Lead/Opportunity/Product/Quotation              | **MISSING** (UI) / foundation present | No bin-listing UI, no restore endpoint, no permanent-delete endpoint anywhere. §3.5                                                                                                           |
| 21  | Global CRM Search     | header action → `/crm/search`                | none                                                                                                      | **MISSING**                           | No cross-entity search; only per-list filter inputs exist. §3.1                                                                                                                               |
| 22  | Bulk Import           | header action (`CrmBulkImport`)              | none                                                                                                      | **MISSING**                           | No `xlsx`/`jspdf`/`exceljs` dependency, no import/export UI anywhere in `apps/ui`. §3.6                                                                                                       |
| 23  | Calendar              | header action → `/crm/calendar`              | none                                                                                                      | **MISSING**                           | No route; read-only aggregation over Meetings/FollowUps/Tasks that don't exist yet. §3.7                                                                                                      |
| 24  | Notifications         | header bell + blocking action-panel          | none                                                                                                      | **MISSING**                           | No bell, no notification generator, no `CrmNotification`/`CrmDeletedNotification` entity. §3.8                                                                                                |

**19 of 24 rows are MISSING outright.** Of the remaining 5: 3 (Contacts, Products,
Quotation) are genuinely complete for their core CRUD scope; 2 (Leads, Pipeline) are
complete for core CRUD but weren't re-verified against every legacy nested tab in this
pass; Accounts is the one row that's PARTIAL in a structurally important way — almost
every MISSING feature above (#1-4, #6-10, #19-21, #23-24) depends on Account fields or
Account-relatable entities that don't exist yet. **Fixing Accounts is the single highest-
leverage next step**, not a parallel/equal-priority item — see §3 and §4.

---

## 2. Already-implemented core entities (verify, don't rebuild)

**Contacts, Products, and Quotations (+printing)** were each implemented in this project
against their own dedicated legacy-parity audit (`Docs/CRM_LEGACY_PARITY.md`,
`Docs/CRM_PRODUCTS_LEGACY_PARITY.md`, `Docs/CRM_QUOTES_LEGACY_PARITY.md`,
`Docs/CRM_QUOTES_PRINT_PARITY.md`), each with its own e2e test file
(`apps/api/test/crm-contacts.e2e-spec.ts`, `crm-products.e2e-spec.ts`,
`crm-quotations.e2e-spec.ts`), and were previously verified to typecheck/lint/build
clean and pass their e2e suites. This audit did not re-read their legacy source line by
line (out of scope for this pass — the user's own instruction is to verify/preserve, not
rebuild), but confirmed their routes, modules, and Prisma models still exist unchanged on
`feature/crm` (`apps/ui/src/app/(dashboard)/crm/{contacts,products,quotes}`,
`apps/api/src/modules/crm/{contacts,products,quotations}`, `packages/database/prisma/
schema.prisma` models `Contact`/`Product`/`Quotation`/`QuotationLineItem`). **COMPLETE**
for their audited core scope.

**Leads and Pipeline/Opportunities** have the same prior-audit/implementation/e2e-test
status (`crm-leads.e2e-spec.ts`, `crm-opportunities.e2e-spec.ts`), confirmed present and
unchanged. Marked **PARTIAL** rather than COMPLETE here only because this pass's agents
flagged two specific legacy surfaces that were _not_ re-verified: legacy's `LeadDetail.tsx`
(a dedicated Lead-360 detail page, separate from the Leads list) and legacy's full
`DealDetail.tsx` tab set (the Pipeline/Opportunity equivalent of Account-360). The current
new-repo `OpportunityDrawer.tsx` is known (from this session's own implementation work) to
already cover Products/Quotes/Stage-History tabs — whether that's the _complete_ legacy
tab set needs a dedicated, narrower audit before claiming full parity, not a rebuild.

### 2.1 Accounts — the one "already started" entity that is NOT complete

Confirmed by direct audit (this pass): the new repo's Account support is a genuinely
**minimal foundation**, explicitly labeled as such in its own code comments
(`accounts.controller.ts:20-23`: _"Minimal CRM Account foundation (Phase 4B)... the full
Account-360 feature set is explicitly out of scope"_).

- **Prisma `Account`** (`schema.prisma`): `id, organizationId, teamId?, name,
customFields(Json)?, isActive, createdBy?, updatedBy?, createdAt, updatedAt,
deletedAt?` — **6 of ~35 legacy fields**. Missing entirely: `accountType`,
  `ownerName`, `industry`, `website`, `phone`, `email`, `linkedin`, both billing and
  shipping address blocks (10 fields), `customerCategory`/`customerClass`/
  `businessType`/`resellerType`, `tags`, `territory`/`region`/`segment`,
  `healthScore`/`healthTrend`, and the entire status-workflow field set
  (`statusTag`/`statusReason`/`statusDate`/`statusInfoType`/`statusUpdatedBy`/
  `statusUpdatedAt`).
- **API**: `GET /crm/accounts` (list, search by name only), `GET /crm/accounts/:id`,
  `POST`, `PATCH` all exist and are permission-gated — but create/update accept only
  `{name}`. **No delete endpoint, no status-change endpoint.**
- **UI**: `AccountCombobox.tsx` only — a name-only `<Select>` picker feeding the Contact
  form, explicitly documented as "not a full Account-360 UI." **No list page, no
  detail/360 page, no create/edit form page, and no `/crm/accounts` route exists in
  `apps/ui/src/app/(dashboard)/crm/` at all.**
- Every one of legacy `AccountDetail.tsx`'s 11 tabs (Overview, Contacts, Opportunities,
  Meetings, Follow-ups, Activities, Tasks, Notes, Documents, Quotations, Products,
  Timeline — see §3.0 for the full list) has **no equivalent in the new repo**, even
  though some of the underlying entities (Contact, Opportunity, Quotation) already exist
  and already relate to Account — nothing renders them scoped to one Account today.

---

## 3. Detailed findings — missing features

### 3.0 The real root cause: Account-360 supporting entities don't exist yet

Legacy's `AccountDetail.tsx` (1920 lines, `D:\New folder\TexaWave_ERP\src\modules\crm\
AccountDetail.tsx`) has 11 tabs, 5 of which are backed by entities that **do not exist at
all** in the new Prisma schema: **Meeting, FollowUp, Activity (the generic
"logged touchpoint" — same entity the WhatsApp/LinkedIn/Email queues read), Task
(CRM-specific — confirmed the existing `Task` model is HR-schema-scoped, FK'd to
`Employee` with HR approval fields, not reusable as-is), Document/Note**. These same five
entities are _also_ the data source for Yet to Happen, Calendar, Notifications, and half
of Overall Data's tracked rows. This is why the dependency graph in §4 puts "Account-360
core entities" first, ahead of every other missing feature, rather than following the
simple top-to-bottom menu order.

### 3.1 CRM Intelligence cluster — Dashboard, Overall Data, Accounts Mining Sheet, Search

**Dashboard** (`/crm/dashboard`, `intelligence/CrmDashboard.tsx`): a single-page executive
view with ~10 widget sections — Revenue Trend (area chart), Executive KPI Summary (6
clickable stat tiles + lead-status donut), Sales/Pipeline Overview (11 stat tiles + 6
charts: stage-wise value/count, deal outcome, deal health, time-in-stage, aging, lost
analysis), Team Performance (per-rep win-rate/attainment), Lead & Source Analytics (4
charts), Product/Revenue Insights, Quick Actions (7 shortcuts), Today's Work, Upcoming,
Activity & Follow-up Health, Attention/Risk. Every number is a client-side aggregation
over live Firebase listeners — nothing server-derived. No dashboard-specific permission
gate beyond module-level access. Depends on: Accounts, Opportunities (already exist) +
Meetings/FollowUps/Activities (don't exist yet) + the 9 legacy "sheet tab" sources
(mostly superseded by features in this doc) + Quotas (§3.4).

**Overall Data** (`/crm/overall-data`, `OverallData.tsx`): a daily-activity tracker table
(9 fixed disposition rows × every day of the month, each cell live-derived — not
manual-entry — from `subscribeCrmMeetings`/`subscribeCrmActivities`/`subscribeCrmAccounts`/
`subscribeCrmContacts`/`subscribeCrmOpportunities`/`subscribeCrmAuditLogs`), a 3-sheet
Excel export (via `ExcelJS`), an inline drill-down with admin-only delete. Depends
entirely on Meetings/Activities (don't exist yet).

**Accounts Mining Sheet** (`/crm/accounts-mining-sheet`, `AccountsMiningSheet.tsx`): a
genuinely independent dataset (own Firebase path `crm/accountsMiningSheet`, own
toggleable-column table, own custom fields) with a full CRUD + "Promote to Lead"
workflow (creates a real Lead row, marks the mining row as promoted, idempotent). Needs
its own new entity (`AccountMiningRow` or similar) — does not depend on Account-360.

**Global CRM Search** (header action, `intelligence/CrmSearch.tsx`): single search box,
purely read-only/navigational, searches both the CRM Core Domain (Account/Contact/
Opportunity/Meeting/FollowUp) and the unified legacy "sheet tab" dataset, results link to
`/crm/accounts/:id` (needs the Account detail route to exist first) or back to the
originating tab.

### 3.2 Lead/Account status-queue cluster — the most important correction in this audit

**Critical finding**: of the 6 screens under this heading, only 2 (Cold Calling Status,
Yet to Happen) are Lead/task-adjacent. The other 4 (Interested, Not Interested, Keep in
Touch, Call Back-Send Info) filter an **Account** field (`CrmAccount.statusTag`), not
`Lead.status` at all — confirmed by reading `domain/AccountStatusQueue.tsx:55`
(`accounts.filter((a) => a.statusTag && tags.includes(a.statusTag))`). All 4 are
literally **one shared component** (`AccountStatusQueue.tsx`, 211 lines) instantiated 4
times with a different `tags` prop — zero per-screen business logic. They share one
status-change dialog (`domain/StatusTagDialog.tsx`) and one service function
(`accountsService.changeCrmAccountStatusTag`), which also **auto-creates a follow-up
Task** for Keep in Touch/Call Back/Send Info — another dependency on the not-yet-existing
Task entity.

The new repo's `Lead.leadStatus` field (confirmed: `String @default("NEW")`, validated
against `LEAD_STATUSES` in `packages/core/src/schemas/crm-lead.schema.ts`) already
structurally matches legacy's _separate, currently-unused_ `CrmLeadStatus` enum
(`NEW|CONTACTED|INTERESTED|...`) — **not** the `CrmStatusTag` values these 4 screens
actually use. This is a real false-positive risk: a shallow grep for "Interested" or "Not
Interested" in the new repo finds the Lead-status enum and could wrongly suggest the
feature exists. It does not — the Account model has no `statusTag`/`statusReason`/
`statusDate`/`statusInfoType`/`statusUpdatedAt` fields at all today.

**Cold Calling Status** (`/crm/cold-calling-status`): a fully independent dataset (own
Firebase path `crm/coldCallingStatus`, raw-import staging rows with a free-text status
column, not an enum), with its own ~545 lines of CRUD/import-export/custom-field logic.
Its only touchpoint with the other 4 screens is a "Route Status" button that opens the
same `StatusTagDialog`.

**Yet to Happen** (`/crm/yet-to-happen`): a cross-entity union of open Tasks
(`status==='Open'`) + pending/overdue FollowUps + non-completed/cancelled Meetings, with
sub-tabs (All/Follow-up/Task/Meeting) and Complete/Cancel actions. Needs the Task/
FollowUp/Meeting entities from §3.0 — no schema change beyond that.

### 3.3 Channel Activity Queue — WhatsApp, LinkedIn, Email

**Not real integrations.** All three are thin route wrappers (14-20 lines each) around one
shared `domain/ChannelActivityQueue.tsx` (397 lines), parameterized by `activityType`.
Confirmed via repo-wide grep: **zero** WhatsApp Business API client, zero LinkedIn API
client, zero SMTP/SendGrid/nodemailer usage anywhere in the legacy CRM module. Every
"send" action is a manual log-entry form (Account + optional Contact + Subject/Notes +
Email-only Direction field) backed by a generic `CrmActivity` entity (`type: 'WhatsApp'|
'LinkedIn'|'Email'`, plus — per §3.2 — also `'Call'` for the Calendar's call events), plus
a client-side-only outbound deep-link button (`wa.me/<digits>`, the stored raw LinkedIn
URL, `mailto:<email>`) that just hands off to the OS/browser. Confirmed MISSING in the new
repo: no `CrmActivity` entity/table of any kind exists yet (this is the same entity §3.0
and §3.2 both need).

**Implementation-effort implication** (true for both §3.2's shared-component cluster and
this one): building "WhatsApp/LinkedIn/Email" does **not** mean integrating three external
APIs — it means building one generic `CrmActivity` entity + one logging-queue component
parameterized by type, instantiated 3 (or, combined with §3.2's `AccountStatusQueue`,
effectively a related but separate) times.

### 3.4 Target / Quotas

`/crm/quotas` (`Quotas.tsx` + `domain/quotasService.ts`): quota fields are `repName`
(free text, not FK'd to a user), `team`, `managerName`, `targetOwner`, `period`
(monthly/quarterly), `periodKey`, `startDate`/`endDate`, `targetAmount`, `metric`
(revenue/closedWonValue/dealsWon), `currency`, `notes`. Attainment is **computed on
read, never stored** — sums the rep's WON opportunities in the period by name-matching
`ownerName` (case/whitespace-insensitive), derives remaining/attainmentPct/
daysRemaining/pace-projected-forecast/status (Achieved/On Track/At Risk/Behind) live.
Permissions: view-all vs. manage vs. delete are three separately-gated capability tiers
(`canManagePipelineConfig`, same, `isCrmAdmin`). Soft-deletes to Recycle Bin. Needs one
new `Quota` model; no dependency on §3.0's entities — this could be built in parallel
with other work, not blocked by Account-360.

### 3.5 Recycle Bin

`/crm/recycle-bin`, **admin-only** (`isCrmAdmin`, not just the broader "CRM Admin"
conceptual role — confirmed strict `user.role === 'admin'`). Covers soft-delete/restore/
permanent-delete for **every** CRM entity, not just the 6 core ones: Account, Lead,
Contact, Opportunity, Product, Quotation, Meeting, FollowUp, Activity, Task, Document,
Note, Pipeline Stage, Quota, Deal Product, Account Mining row. Restore is a single atomic
multi-path write back to the record's exact original location plus any cascade-related
records; permanent-delete is a separate, explicitly-confirmed, truly irreversible action.
**Good news**: `deletedAt` soft-delete already exists on all 6 current core Prisma models
and is already wired into Quotations' delete flow and Products' usage-check — the
data-layer half of this feature is already partially built. The UI (bin list, restore
endpoint, permanent-delete endpoint) does not exist yet, and should be built incrementally
as each new entity (§3.0, §3.4, Mining Sheet, Cold Calling) lands, not as one big-bang
feature at the end.

### 3.6 Bulk Import / Export

Header-level "Bulk Import" (multi-sheet workbook importer, covers 7 sheet kinds) plus a
per-tab `ImportExportBar` reused by Leads/Accounts/Products/Quotations/etc. Excel I/O via
the `xlsx` (SheetJS) library; export also offers PDF (jsPDF+autotable) and a `.doc`
HTML-blob trick (no real docx library). Column-mapping with exact/alias auto-match (no
fuzzy matching), 3 duplicate strategies (skip/update/create), and **confirmed real
custom-fields support** — an unrecognized Excel header auto-creates a persisted,
idempotent custom-field definition. No permission gate beyond module-level access (unlike
Target/Recycle Bin, this is not admin-restricted). New repo has zero `xlsx`/`jspdf`/
`exceljs` dependency and no import/export UI anywhere.

### 3.7 Calendar

`/crm/calendar` (+ `/crm/calendar/event/:type/:id` detail), purely read-only aggregation
(month/week/day views) over Meetings (excl. cancelled/completed), FollowUps (excl.
completed/cancelled), Tasks (excl. completed), and Call-type Activities, plus the legacy
"sheet tab" due-date fields. No create/edit/delete from the Calendar itself — clicking
navigates to the source record. No external calendar sync (no Google Calendar/iCal/OAuth
import anywhere). Needs §3.0's entities; no schema change beyond that.

### 3.8 Notifications

Two UI surfaces, both mounted once in `CRMLayout.tsx`: a header bell dropdown
(Action-Required/Completed/Recycle-Bin tabs) and a full-screen **blocking modal**
(`CrmActionPanel`) that interrupts the user for any overdue/due-today item until
Acknowledge/Done/Snooze — true modal lock, Escape is a no-op, no close button. Generator
scans 6 legacy sheet tabs for due-date-like fields (mostly superseded by this doc's other
rows) plus — confirmed separately — a "domain" notification generator extending to
Accounts/Opportunities/Meetings/FollowUps/Quotations. Real-time Firebase listeners + a 60s
poll to catch pure time-based transitions (e.g. something crossing into "overdue" with no
edit). Snooze options, admin-only permanent-delete into its own nested recycle bin. Needs
a new `CrmNotification`/`CrmDeletedNotification` entity + most of §3.0/§3.2's data to
generate from — reasonably placed late in the dependency order.

---

## 4. Phased implementation plan

The user-suggested order (Overall Data → Cold Calling → Yet to Happen/Call Back/Interested
→ WhatsApp/LinkedIn/Email → Dashboard → Calendar/Notifications → Target → Recycle
Bin/Bulk Import) is **adjusted** here because the audit found a real, blocking dependency
the suggested order didn't account for: most of those features read data from entities
(Meeting/FollowUp/Activity/Task/Document/Note, and an expanded `Account`) that do not
exist in the schema at all yet. Building Overall Data or Yet to Happen first would mean
either building those entities as unplanned scope-creep mid-phase, or building fake/stub
data — both against the stated engineering rules. The plan below front-loads that shared
foundation once, then follows the user's intent as closely as the real dependencies allow.

### Phase 0 — Account-360 foundation (prerequisite for almost everything else)

**IMPLEMENTED (data/API layer only) — see §8 for full evidence.** Delivered: the
`Account` field expansion, all 6 new entities, the cascade-delete, and — pulled forward
from Phase 1 below since it's the same `Account` migration — the `statusTag` workflow
fields and `changeStatusTag` service/endpoint. **Not yet built, by design**: the Account
list/detail/form UI, the status-queue UI (`AccountStatusQueue` equivalent), and the
cascade-delete's extension into the 5 new polymorphic entities (see §8's "deferred"
list) — this phase's instructions explicitly excluded "all dependent screens."

**Scope**: Expand `Account` (add the ~29 missing fields, migration additive-only); add
new models `Meeting`, `FollowUp`, `CrmActivity` (generic, typed, reused by §3.2's
auto-created tasks and §3.3's channel queues), `CrmTask` (CRM-specific — do not reuse
HR's `Task`), `CrmDocument`, `CrmNote`; build the Account list page, detail/360 page (the
11 tabs from §3.0), create/edit form, and the delete + cascade-soft-delete API endpoints
that don't exist today.
**Acceptance criteria**: Account CRUD matches legacy's `AccountFormDialog` field set and
validation (only `name` required); detail page renders all 11 tabs with real data, each
tab's own create/complete/cancel/delete actions work; cascade-delete soft-deletes related
records exactly like legacy's `deleteCrmAccountCascade`; `isCrmAdmin`-only gating
reproduced on every delete action; org-scoped tenant isolation on every new table.
**Tests**: new Prisma migration applied cleanly to the disposable test DB; API e2e tests
for Account CRUD + cascade-delete + each new entity's CRUD; permission tests (non-admin
cannot delete); browser check of the detail page's 11 tabs with representative data.

### Phase 1 — Lead/Account status-queue cluster (§3.2, 4 screens as one build)

**PARTIALLY IMPLEMENTED**: the `statusTag` fields and `changeStatusTag` service/endpoint
landed as part of Phase 0 (above). Remaining for this phase: the shared status-queue UI
component and screens; Cold Calling Status and Yet to Happen are untouched.
**Scope**: Add `statusTag`/`statusReason`/`statusDate`/`statusInfoType`/
`statusUpdatedBy`/`statusUpdatedAt` to `Account` (additive to Phase 0's migration if not
already included); build one shared status-queue UI component (mirroring
`AccountStatusQueue`) instantiated for Interested/Not Interested/Keep in Touch/Call
Back-Send Info; build the status-change dialog + service, including the
auto-create-or-reschedule-a-CrmTask side effect.
**Acceptance criteria**: changing status from any of the 4 screens is instantly reflected
in the others (same underlying Account row, no duplication); per-tag required fields
enforced server-side, not just client-side; auto-task-creation matches legacy's title
format and reschedule-if-already-open behavior.
**Tests**: API tests for the status-change service (all 5 tag transitions, required-field
validation, task auto-creation/reschedule); e2e covering a status round-trip across all 4
screens; browser check.

### Phase 2 — Yet to Happen (§3.2)

**Scope**: cross-entity read aggregation over Phase 0's Task/FollowUp/Meeting.
**Acceptance criteria**: sub-tab counts match a seeded mix of open/overdue/completed
records across all 3 entity types; Complete/Cancel actions route to the correct
entity-specific service.
**Tests**: API test for the aggregation query; browser check of sub-tabs and actions.

### Phase 3 — Cold Calling Status (§3.2) and Accounts Mining Sheet (§3.1)

**Scope**: two independent new entities + their CRUD/import-export screens; Mining
Sheet's Promote-to-Lead workflow (reuses the existing Lead create path).
**Acceptance criteria**: promote-to-lead is idempotent (disabled once promoted, matching
legacy); both screens' custom-field support matches Bulk Import's auto-create behavior
(may ship Phase 3 ahead of full Bulk Import, §3.6, with a narrower per-screen import first
if Phase 6 isn't ready yet — flag as an open sequencing decision, §6).
**Tests**: API CRUD tests for both new entities; promote-to-lead e2e test; browser check.

### Phase 4 — Channel Activity Queue: WhatsApp / LinkedIn / Email (§3.3)

**Scope**: one `CrmActivity`-backed logging queue (shares the entity from Phase 0),
instantiated 3 times; `wa.me`/raw-URL/`mailto:` deep-link buttons.
**Acceptance criteria**: logging an activity shows up on the related Account's Phase-0
Timeline tab (legacy requirement — confirmed `ChannelActivityQueue` activities surface on
the unified Account timeline); deep-link buttons disabled when no phone/URL/email on file,
matching legacy exactly.
**Tests**: API CRUD test for `CrmActivity` filtered by type; browser check of all 3 deep
links and the disabled state.

### Phase 5 — Target / Quotas (§3.4)

**Scope**: new `Quota` model (independent of Phases 0-4, can be reordered earlier if
desired — flagged in §6); live attainment computation service.
**Acceptance criteria**: attainment/forecast/status match legacy's computation exactly for
a seeded set of WON opportunities; duplicate-quota guard (rep+period+periodType) enforced;
three-tier permission (view-all/manage/delete) reproduced.
**Tests**: unit tests for the attainment/forecast computation against known inputs; API
permission tests for the 3 tiers; browser check of the live-updating Set-Target form.

### Phase 6 — CRM Dashboard and Global Search (§3.1)

**Scope**: Dashboard's ~10 widget sections (built once most underlying data exists from
Phases 0-5); Global Search across Account/Contact/Opportunity/Meeting/FollowUp + the new
entities.
**Acceptance criteria**: every stat tile/chart is clickable and navigates correctly
(matching legacy's 20+ navigation targets); Search results link to the Phase-0 Account
detail page.
**Tests**: component tests for key aggregation functions (revenue trend, stage-wise
value, win rate); browser check of navigation from each major widget; Search smoke test
across all result types.

### Phase 7 — Overall Data, Calendar, Notifications (§3.1, §3.7, §3.8)

**Scope**: Overall Data's daily-activity tracker + Excel export (now meaningful, since
Meetings/Activities exist); Calendar's read-only aggregation view; Notifications' bell +
blocking action-panel + generator (now has real due-date data across every prior phase to
scan).
**Acceptance criteria**: Overall Data's 9 tracked rows match seeded activity counts
per-day; Excel export produces the same 3-sheet structure as legacy; Calendar's agenda
strip and month/week/day views render seeded Meetings/FollowUps/Tasks correctly;
Notifications fire for due/overdue items from every entity type introduced so far and the
blocking modal behaves exactly like legacy (no close button, Escape no-op).
**Tests**: API tests for the daily-aggregation query and the notification-candidate
generator; browser check of Excel export file structure, Calendar views, and the
notification bell/action-panel interaction (including the 60s-poll-driven overdue
transition, which may need a test-only accelerated clock).

### Phase 8 — Recycle Bin and Bulk Import/Export (§3.5, §3.6)

**Scope**: bin-list UI + restore + permanent-delete endpoints across every entity type
that now exists (not just the original 6); generic Bulk Import/Export engine
(column-mapping, duplicate strategies, custom-fields auto-create) wired to every importable
entity introduced across Phases 0-7.
**Acceptance criteria**: restore puts a record back with all cascade-related records
intact (matching legacy's atomic multi-path restore); permanent-delete requires explicit
confirmation and is irreversible; Bulk Import's duplicate-detection and custom-field
auto-create match legacy; export supports at minimum Excel (PDF/`.doc` export are
lower-priority — flag as an open decision, §6, given their legacy implementations are
already somewhat improvised — the `.doc` export is an HTML-blob trick, not a real docx).
**Tests**: API tests for restore (incl. cascade) and permanent-delete (incl. admin-only
gate) per entity type; Bulk Import e2e test with a representative spreadsheet (valid rows,
invalid rows, duplicates, an unrecognized custom-field column); browser check.

---

## 5. Cross-cutting requirements for every phase

- Every new Prisma model is additive-only (new migration, never editing historical
  migrations), org-scoped (`organizationId`), and follows the established
  `createdBy/updatedBy/createdAt/updatedAt/deletedAt` audit-column convention already used
  by every CRM entity.
- Every new permission follows the existing `crm.<entity>.read`/`.write` convention
  (`packages/database/prisma/permissions/catalog.ts`); a separate `.delete` permission is
  used only where legacy's own admin-only-delete pattern demands it (matching the existing
  `crm.quotation.delete` precedent), not by default.
- Every new nav entry is added to the version-controlled menu catalogue
  (`packages/database/prisma/menu/catalog.ts`), gated by the matching `.read` permission,
  under the existing `crm` parent group — not the old per-seed `defaultMenuItems` pattern
  (retired during the HR branch merge).
- Controllers never touch Prisma directly; services never import Prisma directly — route
  through the repository layer, per `CODING_STANDARDS.md §3` (already enforced by
  `apps/api/eslint.config.cjs`'s `no-restricted-imports` rules).
- No fake integrations: WhatsApp/LinkedIn/Email ship as exactly what legacy actually is
  (manual logging + deep-links), not as a promised-but-unbuilt API integration.
- Every phase runs its own typecheck/lint/build and the relevant e2e suite against the
  disposable test database before being considered done, following the same verification
  discipline already established for CRM Quotes/Quotations in this project
  (`DATABASE_URL` pointed at `texawave_erp_test`, `REDIS_URL` on a non-zero index, never
  the shared dev database).

## 6. Open decisions requiring your input before implementation

1. **Account field scope**: port all ~29 missing legacy Account fields in Phase 0, or a
   reduced set with the rest deferred? (Affects Phase 0's size significantly.)
2. **CrmTask vs. reusing/extending HR's `Task`**: confirmed HR's `Task` is
   Employee-FK'd with HR-specific approval fields — recommend a separate `CrmTask` model
   rather than overloading HR's, but flagging for your explicit sign-off since it's a
   new table, not a reuse.
3. **Quota sequencing**: Phase 5 has no hard dependency on Phases 0-4 and could be
   pulled earlier if you want a quick, self-contained win — your call.
4. **Bulk Import scope**: build the full multi-entity engine once (end of the plan, Phase 8) or build narrower per-entity import first for Mining Sheet/Cold Calling (Phase 3) and
   generalize later? The audit found real custom-fields behavior worth preserving either
   way.
5. **PDF/.doc export formats**: legacy's own `.doc` export is an HTML-blob workaround, not
   a real docx library. Worth deciding whether to preserve that exact workaround, use a
   real docx library, or drop `.doc` export and keep Excel+PDF only.
6. **LeadDetail.tsx and DealDetail.tsx re-verification**: flagged in §2 as not re-audited
   in this pass — worth a short, dedicated follow-up audit before claiming full COMPLETE
   status on Leads/Pipeline, separate from the Phase 0-8 plan above.

## 7. Verification record

- Audit performed via 6 parallel read-only research agents against
  `D:\New folder\TexaWave_ERP` (Read/Grep/Glob/read-only Bash only) plus this session's
  own direct reads/greps of `D:\New folder\Texawave_Erp_Production` (current Prisma
  schema, permission catalog, menu catalogue, route/feature directory listings).
- Confirmed via direct read: the existing `Task` Prisma model is HR-schema-scoped and not
  reusable for CRM as-is.
- **No application code, Prisma schema, migration, permission, or UI file was created or
  modified by this audit** — only this document and the research agents' read-only tool
  calls. `git status --short` on `Texawave_Erp_Production` at the time of writing shows
  only this new file plus the pre-existing CRM work already on `feature/crm`; the legacy
  repo was not touched.
- Per the governing instruction ("First deliver the complete audit and phased plan. Stop
  before modifying application code"), this document was the complete deliverable for
  that turn — no Phase 0-8 work had begun as of §1-§6 above. Phase 0 was subsequently
  approved and implemented; see §8.

## 8. Phase 0 implementation record (Account-360 foundation, data/API layer)

**Branch**: `feature/crm`. Implemented after re-checking the branch/working tree was
clean (only the 3 pre-existing, unrelated items — `.claude/`, this doc, an unrelated
interceptor spec — were present beyond already-committed CRM work).

### 8.1 Design decisions made for this phase (recorded per the instruction to not guess)

1. **Account field scope**: added exactly the fields confirmed read/written by legacy
   `AccountFormDialog.tsx`'s 5 tabs, `AccountDetail.tsx`'s header/Overview, and
   `AccountStatusQueue`/`StatusTagDialog` — ~35 fields total. Deliberately **not** added
   (present in legacy's `CrmAccount` type but never confirmed rendered/edited by any
   screen the audit read): `territory`, `region`, `segment`, `healthScore`,
   `healthTrend`, `linkedSalesCustomerId` (legacy's own type comment: "never written to
   automatically"). The Lead→Account conversion link needed no new column — it already
   exists from the other side (`Lead.linkedAccountId`, confirmed present in the schema
   before this phase).
2. **Polymorphic relation design**: `relatedType` (`account`|`contact`|`opportunity`|
   `lead`) + `relatedId` (Int), matching legacy's `CrmRelatedType` exactly, on Meeting/
   FollowUp/CrmActivity/CrmTask/CrmDocument. Prisma cannot FK a single column to four
   different target tables, so `relatedId` carries no `@relation` — a new shared helper,
   `apps/api/src/modules/crm/shared/related-entity.ts` (`assertRelatedEntityExists`),
   enforces the existence/tenant-match check at the repository layer instead, the same
   role `OpportunitiesRepository`'s explicit `accountId`/`contactId` checks already play.
3. **CrmNote stays non-polymorphic**: confirmed by direct audit that legacy's Notes
   feature (`intelligence/notesService.ts`) is scoped only to an Account
   (`crm/notes/{companyKey}`), architecturally separate from the `CrmActivity`-typed
   `'Note'` entries also found in legacy — these are two distinct things both called
   "Notes" in legacy; both are modeled, but only `CrmNote` has a real `accountId` FK.
4. **CrmTask vs. HR's `Task`**: inspected the `Task` Prisma model directly: hard FK'd to
   `Employee` (`assigneeId`),
   with HR-specific approval-request fields (`isEmployeeCreated`, `requestToAdmin`,
   `adminApproved`). Confirmed structurally incompatible with CRM's polymorphic
   Account/Contact/Opportunity/Lead relation and 2-state (Open/Completed) model — built
   a separate `CrmTask` instead of coupling CRM to HR's assumptions.
5. **`OVERDUE` (FollowUp) is never persisted**: confirmed legacy's
   `getEffectiveFollowUpStatus()` computes it at read time from `scheduledAt` vs. now and
   never writes it back. Reproduced identically — the DB `status` column only ever
   stores PENDING/COMPLETED/CANCELLED/MISSED/RESCHEDULED; `FollowUpsService` derives
   `effectiveStatus` on every read (unit-tested, §8.3).
6. **Meeting/FollowUp reschedule asymmetry preserved as-observed**: legacy's
   `rescheduleCrmMeeting` sets status to `RESCHEDULED`; `rescheduleCrmFollowUp` sets it
   back to `PENDING`. Confirmed via direct audit this is legacy's actual behavior, not a
   bug in the audit — reproduced exactly, not "fixed" to be symmetric (matches this
   project's established convention of reproducing observed legacy quirks, e.g.
   `OpportunitiesRepository.setOnHold`'s own documented stage-handling quirk).
7. **Delete permission shape**: one ungated `.delete` permission per new entity
   (`crm.meeting.delete`, `crm.followup.delete`, etc.) plus a new `crm.account.delete` —
   matching the existing `crm.quotation.delete` precedent (legacy's single-tier
   `isCrmAdmin`-only gate), not a `.own/.team/.all` scope, since legacy CRM has no team
   dimension for any of these entities (confirmed by the original 6-way audit).

### 8.2 Re-audit performed before touching shared models (per the explicit instruction)

Two additional read-only agents were run before any schema/code change:

- **Meeting/FollowUp/CrmActivity/CrmTask/CrmDocument/CrmNote field-level audit** — read
  `domain/types.ts`, `meetingsService.ts`, `followupsService.ts`, `activitiesService.ts`,
  `tasksService.ts`, `documentsService.ts`, `intelligence/notesService.ts`,
  `relatedLookup.ts`, `config.ts` in full. This is what produced the exact field lists,
  status enums, and the decisions in §8.1.
- **LeadDetail.tsx / DealDetail.tsx re-audit** (explicitly requested, since a prior pass
  had skipped them) — confirmed Lead and Account use the identical polymorphic
  `relatedType`/`relatedId` pattern for Meeting/FollowUp/CrmActivity/CrmDocument: Notes
  use a dedicated per-entity-id subscription (not relatedType/relatedId, but still
  effectively polymorphic by (entityType, entityId) args). **Opportunity (Deal) does
  NOT** — `DealDetail.tsx` has no Meetings/FollowUps/Documents/Notes tabs at all today,
  only Activities (with a confirmed legacy bug: its filter checks `relatedId` alone,
  omitting the `relatedType` conjunct Lead/Account use — not reproduced, flagged as a
  legacy-only inconsistency, not a pattern to copy). `Lead.emailOptOut`/
  `dataProcessingBasis` (the Data Privacy tab) were confirmed **already present** in the
  current `Lead` model from prior work — no gap found there.

### 8.3 Files changed

**New Prisma migration**: `packages/database/prisma/migrations/
20261012160000_add_crm_account_360_foundation/` — additive only (`ALTER TABLE accounts
ADD COLUMN` ×29, 8 new `CREATE TABLE`s: `crm_meetings`, `crm_meeting_reschedules`,
`crm_follow_ups`, `crm_follow_up_reschedules`, `crm_activities`, `crm_tasks`,
`crm_documents`, `crm_notes`). Generated via `prisma migrate diff` against the live dev
DB (not `migrate dev`'s shadow-database replay — see §8.5 for why) and applied via
`migrate deploy` to both the dev DB and the disposable `texawave_erp_test` DB.

**Schema**: `packages/database/prisma/schema.prisma` — `Account` expanded; 8 new models
added; `Organization`'s CRM relation list extended.

**Permissions**: `packages/database/prisma/permissions/catalog.ts` — added
`crm.account.delete` plus `crm.{meeting,followup,activity,task,document,note}.
{read,write,delete}` (19 new permission codes total).

**New NestJS modules** (each: `dto/`, `*.repository.ts`, `*.service.ts`,
`*.controller.ts`, `*.module.ts`), under `apps/api/src/modules/crm/`:
`meetings/`, `follow-ups/`, `activities/`, `tasks/` (exports `CrmTasksService`,
`class CrmTasksController`/`CrmTasksService`/`CrmTasksRepository` — distinct names from
HR's own `tasks/` module), `documents/`, `notes/`. Plus two new shared files:
`shared/related-entity.ts` (`assertRelatedEntityExists`), `shared/activity-types.ts`
(`ACTIVITY_TYPES`, `ACTIVITY_DIRECTIONS`, shared between CrmActivity and CrmFollowUp).

**Expanded existing Account module**: `accounts/dto/account.dto.ts` (full field set +
`ChangeAccountStatusTagDto`), `accounts.repository.ts` (field persistence, cascade
`softDelete`, `changeStatusTag`), `accounts.service.ts` (per-tag required-field
validation + auto-task-creation side effect, injecting `CrmTasksService`),
`accounts.controller.ts` (`DELETE`, `PATCH :id/status-tag`), `accounts.module.ts`
(imports `CrmTasksModule`).

**Registered** all 6 new modules in `apps/api/src/app.module.ts`.

**Tests**: extended `apps/api/test/crm-accounts.e2e-spec.ts` (new Phase-0 field CRUD,
status-tag validation + auto-task-creation, cascade-delete, tenant isolation, delete
permission); new `apps/api/test/crm-meetings.e2e-spec.ts` (representative of the 5
polymorphic entities — relation-existence validation incl. cross-org rejection, status
transitions, complete, reschedule with history, soft-delete, tenant isolation); new unit
test `apps/api/src/modules/crm/follow-ups/follow-ups.service.spec.ts` (the `OVERDUE`
computed-status derivation, 3 cases).

### 8.4 Test results (actually run, not assumed)

- `pnpm --filter api run typecheck` — **pass** (api, database, ui packages all clean).
- `pnpm --filter api run lint` — **pass**.
- `follow-ups.service.spec.ts` (unit, mocked, no DB) — **3/3 pass**.
- Full CRM e2e regression, run against the disposable `texawave_erp_test` database
  (`DATABASE_URL` pointed at it, `REDIS_URL` on a non-zero index, per the suite's own
  safety guard) — **7 files, 99/99 tests pass**: `crm-accounts.e2e-spec.ts` (10, incl.
  7 new Phase-0 cases), `crm-meetings.e2e-spec.ts` (6, new), plus the pre-existing
  `crm-contacts`/`crm-leads`/`crm-opportunities`/`crm-products`/`crm-quotations` suites —
  **all unaffected and still green**, confirming Phase 0 didn't regress any existing CRM
  functionality.
- Not run in this pass: FollowUps/Activities/CrmTasks/Documents/CrmNotes don't yet have
  their own dedicated e2e suites (Meetings was chosen as the one representative
  deep-dive, per effort/scope tradeoffs) — they share the exact same repository/service
  pattern and the same `assertRelatedEntityExists` validation already covered by the
  Meetings suite, but each entity's own specific workflow (FollowUp's reschedule-to-
  PENDING asymmetry, CrmTask's audit-only-on-Completed quirk, CrmDocument's no-update
  design, CrmNote's account-only scoping) does not yet have its own direct test.
  Flagged as a concrete, bounded follow-up, not a gap silently left undocumented.

### 8.5 An unplanned, resolved blocker: pre-existing migration-history corruption

Both the dev and disposable test databases turned out to already have broken migration
history, inherited from an earlier, unrelated session (an abandoned local-only commit
had created `candidates`/`loans`/`bonuses`/an old-shape `payroll_periods`/`payslips`/
`payroll_audit_logs` tables, which collided with the real payroll migrations later
merged in from origin). This blocked `prisma migrate dev` entirely (it replays full
migration history into a throwaway shadow DB) before any Phase 0 migration could be
created.

Resolved without editing any historical migration file (per the explicit instruction)
and without resetting either database: confirmed all 8 orphaned tables were empty (0
rows, in both DBs) via direct read-only queries, dropped only those specific
tables/columns via `prisma db execute`, applied the real pending payroll migrations via
`migrate deploy` (sequential file-apply, no shadow DB), then generated **only** the
Phase-0 schema diff via `prisma migrate diff` and hand-placed it as a new migration file
applied via `migrate deploy`. The disposable test DB had the same corruption plus one
migration recorded as genuinely **failed** (not just orphaned-but-applied) — resolved via
`prisma migrate resolve --rolled-back` after confirming (via direct query) it had created
zero of its 17 tables before failing. Full detail of every command run is in this
session's transcript; summarized here for the record since it materially affected how
Phase 0 was delivered.

### 8.6 Explicitly deferred (not done in this phase, by instruction or by scope)

- **All UI** — no Account list/detail/360 page, no status-queue screens, no routes, no
  menu-catalogue entries. Nothing in `apps/ui` was touched.
- **Cascade-delete's reach**: `Account.softDelete` cascades to Contact/Opportunity/
  Quotation/CrmNote (direct FK children) but **not** to Meeting/FollowUp/CrmActivity/
  CrmTask/CrmDocument (polymorphic, no FK) — legacy's own cascade does reach these, but
  doing so safely needs a cross-module call pattern this phase didn't build out.
  Documented in the repository code itself, not just here.
- **Auto-task "reschedule if already open"**: `AccountsService.changeStatusTag` always
  creates a new `CrmTask` for Keep in Touch/Call Back/Send Info rather than checking for
  and rescheduling an already-open one for the same account (legacy's actual behavior).
  Simplified for this phase; documented in the service code's own comment.
- **`CrmActivity` auto-creation on `Meeting.complete`**: legacy's `completeCrmMeeting`
  silently logs a `'Meeting'`-typed `CrmActivity`. Not implemented — would need
  `MeetingsService` to depend on `ActivitiesService` cross-module; deferred as a small,
  well-scoped follow-up rather than adding that coupling under this phase's time budget.
- **Dedicated e2e suites** for FollowUps/Activities/CrmTasks/Documents/CrmNotes (§8.4).

### 8.7 Next CRM phase

Per the plan in §4, **Phase 1's remaining piece** (the shared status-queue UI + Cold
Calling Status + Yet to Happen) is the natural next step, since its backend half
(`statusTag` fields, `changeStatusTag` endpoint) already landed in this phase. The
Account-360 list/detail/form UI (the rest of "Phase 0" as originally scoped) is the other
immediately-unblocked option, now that its backend exists. Recommend confirming with the
user which of these two to prioritize before starting, rather than assuming.

**Resolution: the Account-360 UI option was taken — see §9.**

## 9. Phase 1A implementation record (Account-360 UI)

Built the full Account-360 UI consuming Phase 0's backend. No backend files were
modified — every route, DTO shape, and business rule was re-confirmed directly against
the controller/service/repository source before being mirrored client-side.

### 9.1 `packages/api-types` (hand-written contracts, per this package's own convention)

- `src/crm-accounts.ts` — full rewrite from the Phase 4B minimal `{id,name}` shape to
  the complete ~35-field `Account` contract (all fields in `account.dto.ts` +
  `schema.prisma`'s `Account` model, incl. `statusTag`/`statusReason`/`statusDate`/
  `statusInfoType`/`statusUpdatedBy`/`statusUpdatedAt`). `annualRevenue` typed `string`
  on the read shape, `number` on `CreateAccountInput`/`UpdateAccountInput` (Decimal
  convention, matching `crm-opportunities.ts`'s `estimatedValue` precedent). Added
  `ChangeAccountStatusTagInput`.
- `src/crm-related-entity.ts` (new) — `RelatedType`, `ActivityType`, `ActivityDirection`,
  mirroring `apps/api/src/modules/crm/shared/{related-entity,activity-types}.ts`.
- `src/crm-meetings.ts`, `src/crm-follow-ups.ts`, `src/crm-activities.ts`,
  `src/crm-tasks.ts`, `src/crm-documents.ts`, `src/crm-notes.ts` (all new) — one file per
  entity, each mirroring its DTO file's exact fields/required-optional/enum unions, plus
  the full read shape (incl. `Meeting.reschedules`/`FollowUp.reschedules` arrays and
  `FollowUp.effectiveStatus`, confirmed from `schema.prisma`'s
  `CrmMeetingReschedule`/`CrmFollowUpReschedule` models and
  `follow-ups.service.ts`'s `withEffectiveStatus`). `crm-notes.ts`'s
  `QueryCrmNotesInput.accountId` is required (not optional), matching
  `notes.controller.ts`'s raw `@Query("accountId", ParseIntPipe)` param, not the
  paginated DTO's optional fields.
- `src/index.ts` — registered all 7 new exports.
- Routes/verbs for the 6 new modules were taken directly from each
  `*.controller.ts` (read in full this session), not re-derived — e.g. confirmed
  `PATCH /crm/meetings/:id/status`, `POST /crm/meetings/:id/complete`,
  `POST /crm/meetings/:id/reschedule`, `DELETE /crm/meetings/:id` (204); `CrmDocument`
  has create/list/delete only (no update DTO/route exists); `CrmNote` has create/delete
  only, scoped by `accountId` not `relatedType`/`relatedId`.

### 9.2 `packages/core` (zod schemas)

- `src/schemas/crm-account.schema.ts` (new) — `createAccountSchema` (full ~29-field
  Account form schema, only `name` required, matching `CreateAccountDto` exactly),
  `updateAccountSchema` (`.partial()`), and `changeAccountStatusTagSchema` — a
  `superRefine` that reproduces `AccountsService.changeStatusTag`'s
  `assertStatusTagFieldsPresent` helper line-for-line (`apps/api/src/modules/crm/
accounts/accounts.service.ts:19-44`): `Not Interested` → `statusReason` required,
  `Keep in Touch`/`Call Back` → `statusDate` required, `Send Info` →
  `statusInfoType` required. This gives the status-tag dialog client-side validation
  before the request round-trip, per the task's explicit requirement.
- Removed the old minimal `createAccountSchema`/`CreateAccountFormValues` that had been
  co-located in `crm-contact.schema.ts` (confirmed zero existing callers via grep before
  removing) and replaced it with the above, full version, in its own file.
- `src/index.ts` — registered the new export.

### 9.3 `apps/ui/src/features/crm/accounts` (expanded)

- `api.ts` — added `updateAccount`, `deleteAccount`, `changeAccountStatusTag`
  (`PATCH /crm/accounts/:id/status-tag`, confirmed route) alongside the existing
  `listAccounts`/`getAccount`/`createAccount`.
- `hooks.ts` — added `useAccount(id)`, `useUpdateAccount`, `useDeleteAccount`,
  `useChangeAccountStatusTag`, all invalidating both the list cache key and the
  single-account cache key on success.
- `components/AccountForm.tsx` (new) — all ~29 optional fields grouped into Company
  Info / Contact Details / Billing Address / Shipping Address / Business Profile / Tags
  sections (legacy's 5-tab grouping, reproduced as stacked sections rather than nested
  tabs since it's already inside an outer Account-360 tab), only `name` required. Tags
  entered as a comma-separated string, parsed to `string[]` on submit (no dedicated tag-
  chip input component exists in `ui-kit` yet — simplest faithful option within scope).
  A "Same as billing" button copies billing → shipping fields.
- `components/StatusTagDialog.tsx` (new) — tag picker + the correct per-tag companion
  field, driven by `changeAccountStatusTagSchema`. Reachable from both the Accounts list
  row action and the Account-360 Overview tab header, per the task's explicit
  requirement.
- `components/AccountList.tsx` (new) — search by name, filter by `statusTag`,
  pagination, "Add Account" (routes to `/crm/accounts/new`), row click → detail page,
  row actions (Status, View, Delete). Mirrors
  `features/crm/quotations/components/QuotationList.tsx`'s structure exactly.
- `components/AccountDetail.tsx` (new) — the Account-360 tabbed container, using
  `ui-kit`'s `Tabs` component (same one already used by
  `features/hr/payroll/components/PayrollView.tsx`, the only other tabbed-view precedent
  in the codebase). 10 tabs: Overview, Contacts, Opportunities, Quotations, Meetings,
  Follow-ups, Activities, Tasks, Documents, Notes.
- `components/tabs/*.tsx` (10 new files, one per tab) — see §9.4/§9.5.

### 9.4 Tabs reusing existing entities (do-not-rebuild requirement)

- `ContactsTab.tsx` — reuses `features/crm/contacts/hooks.ts`'s `useContacts`/
  `useCreateContact` and `components/ContactForm.tsx` unmodified, scoped via
  `{accountId}`.
- `OpportunitiesTab.tsx` — reuses `features/crm/opportunities/hooks.ts`'s
  `useOpportunities`, scoped via `{accountId}`. Read-only list (no inline kanban/edit
  rebuild — the full Opportunity edit/stage workflow already lives in the Pipeline
  board, which has no scoped embeddable component to reuse as-is); links out to
  `/crm/pipeline` for that workflow.
- `QuotationsTab.tsx` — reuses `features/crm/quotations/hooks.ts`'s `useQuotations`,
  scoped via `{accountId}`. Read-only list with links to `/crm/quotes/new?accountId=`
  and `/crm/quotes/:id` (both pre-existing routes) for create/edit — does not rebuild
  `QuotationForm`.
- Confirmed via direct grep of `crm-contacts.ts`/`crm-opportunities.ts`/
  `crm-quotations.ts` that `accountId` is already a field on each entity's `Query*Input`
  type, exactly as the task stated.

### 9.5 New entity tabs (Meetings/Follow-ups/Activities/Tasks/Documents/Notes)

Each is `apps/ui/src/features/crm/{meetings,follow-ups,activities,tasks,documents,notes}/
{api.ts,hooks.ts}` (new, mirroring `opportunities/{api.ts,hooks.ts}`'s thin-wrapper/
React-Query pattern) plus one tab component under
`accounts/components/tabs/`:

- `MeetingsTab.tsx` — list + create (mode/date/time/location/link/agenda) + status
  dropdown (`PATCH .../status`) + Complete dialog (`POST .../complete`) + Reschedule
  dialog (`POST .../reschedule`). All creates hardcode
  `relatedType: 'account', relatedId: <this account>`.
- `FollowUpsTab.tsx` — list showing **`effectiveStatus`**, not the stored `status`
  (per the task's explicit requirement, since `OVERDUE` is display-only/never
  persisted) + create + status dropdown + Reschedule dialog.
- `ActivitiesTab.tsx` — list + log-activity form (type/subject/notes, Direction field
  shown only when `type === 'Email'`, matching the DTO comment that direction is
  "Email-only semantically"). `'Stage Change'` excluded from the type picker (legal but
  not user-selectable, per `ACTIVITY_TYPES`'s own comment).
- `TasksTab.tsx` — list + create (title/dueDate/assignedTo/priority/notes) +
  mark-complete via a checkbox bound to `UpdateCrmTaskStatusInput` (`Open`/`Completed`
  only — confirmed distinct from HR's multi-state `Task`).
- `DocumentsTab.tsx` — list + add (name/link/notes) + delete. No edit UI, matching the
  confirmed absence of an update DTO/route for `CrmDocument`.
- `NotesTab.tsx` — list + add (content only) + delete, scoped by `accountId` directly
  (not `relatedType`/`relatedId`) and with no edit UI, matching `CrmNote`'s confirmed
  shape.

### 9.6 Routes

- `apps/ui/src/app/(dashboard)/crm/accounts/page.tsx` → `AccountList`.
- `apps/ui/src/app/(dashboard)/crm/accounts/new/page.tsx` → `AccountForm` on a full
  page (mirrors the Quotations `/new`-page pattern, since the Account form has far more
  fields than a `Dialog` comfortably holds for first-time creation).
- `apps/ui/src/app/(dashboard)/crm/accounts/[id]/page.tsx` → `AccountDetail`, with the
  same numeric-id-or-`notFound()` guard as `crm/quotes/[id]/page.tsx`.
- Editing an existing account happens in a `Dialog` from the Overview tab (and, for
  completeness, is also wired the same way in principle from the list — see §9.3's
  `AccountList` row actions, which route to the detail page rather than opening a
  duplicate edit dialog, to avoid two different edit entry points drifting apart).

### 9.7 Menu entry

- `packages/database/prisma/menu/catalog.ts` — added `crm-accounts` ("Accounts",
  `/crm/accounts`, gated by `crm.account.read`) as the new order-1 child of `crm`,
  renumbering the existing `crm-leads`/`crm-pipeline`/`crm-contacts`/`crm-products`/
  `crm-quotes` entries' `order` by +1 to make room, in the exact same object-literal
  style as the existing entries. Confirmed `crm.account.read` already exists in
  `packages/database/prisma/permissions/catalog.ts:523` (added in Phase 0) — no new
  permission needed.

### 9.8 Verification actually performed (and what was NOT verified)

- `pnpm --filter @texawave-erp/api-types run typecheck` — **pass**.
- `pnpm --filter @texawave-erp/core run typecheck` — **pass**.
- `pnpm --filter @texawave-erp/database run build` — **pass** (menu catalog change
  only; no schema/migration touched).
- `pnpm --filter api run typecheck` — **pass**.
- `pnpm --filter api run lint` — **pass**.
- `pnpm --filter ui run typecheck` — **pass**.
- `pnpm --filter ui run lint` — **pass** (0 errors/warnings, `eslint .`).
- `pnpm --filter ui run build` (Next.js production build, Turbopack) — **pass**,
  `/crm/accounts`, `/crm/accounts/new`, `/crm/accounts/[id]` all appear in the route
  manifest with the expected static/dynamic markers.
- Full e2e regression run against the disposable `texawave_erp_test` database
  (`DATABASE_URL`/`REDIS_URL` pointed at it per the suite's safety guard, confirmed via
  `docker exec ... psql` that the DB pre-existed and `prisma migrate deploy` reported no
  pending migrations) — the `-- crm` argument did not scope vitest to CRM files as
  intended, so the **entire** e2e suite ran instead: **1216/1217 tests passed, 45/46
  files passed.** The one failure, `hr-calendar.e2e-spec.ts` → "weekly-off rules > of 8
  simultaneous overlapping rules of one scope exactly one wins, none is a 500", is an
  HR-module concurrency test with no relation to anything touched in this phase (no CRM
  file, no shared infrastructure file was modified) and reads as a pre-existing
  flaky/race-prone test, not a regression introduced here. Every CRM suite —
  `crm-accounts`, `crm-contacts`, `crm-leads`, `crm-meetings`, `crm-opportunities`,
  `crm-products`, `crm-quotations` — passed in full, confirming this phase's backend
  understanding (routes, DTOs, response shapes) was accurate and that no backend files
  were in fact touched.
- **No new backend e2e tests were added.** Reading every controller/DTO/service method
  this phase's UI consumes did not surface a contract gap (route, verb, required field,
  or status code) that diverged from what was already documented in §8/the task's own
  pre-verified facts — so there was nothing to add a regression test for. If a real gap
  had been found, the task's instruction was to add one; none was found.
- **No real browser-automation tool was available in this session.** Nothing above
  constitutes interactive UI verification. What was NOT done: no page was ever rendered
  in a browser, no click/submit flow was exercised against a running UI + API pair, no
  screenshot was taken, no manual or automated end-to-end user-flow test ran. The
  "build succeeds" and "typecheck/lint are clean" results prove the code compiles and
  is internally type-consistent against the real `api-types`/DTO contracts — they do
  not prove any dialog opens correctly, any form submits successfully against a live
  API, any React Query cache invalidation actually refreshes the right list, or that
  any visual layout is usable. This gap applies to every component built in §9.3-9.5
  equally; none of it should be treated as "working" beyond compiling and
  type-checking cleanly against a contract that was cross-referenced line-by-line
  against the real backend source.

### 9.9 Explicitly deferred / known gaps

- **Timeline tab** — not built. The task made this conditional ("only build it if the
  required tabs are fully done and verified first"); given the browser-verification gap
  in §9.8, "verified" was never reached, so building the nice-to-have on top was
  skipped rather than adding more unverified surface area.
- **Products tab** — explicitly out of scope per the task; not built.
- **Cascade-delete's reach** — unchanged from Phase 0's own documented gap (§8.6):
  `Account.softDelete` still does not cascade to Meeting/FollowUp/CrmActivity/CrmTask/
  CrmDocument. Deleting an account from `AccountList`/`AccountDetail` in this UI inherits
  that exact backend gap; not something this UI phase could or should fix itself.
  Documented in the backend code already — refer there, not re-stated here as new.
  Doesn't block normal account deletion for an account without such child rows; still a
  real gap for one that has them.
  (See Phase 0's §8.6 for the exact text.)
  Not a new gap introduced by this phase.
- **No tag-chip input component** — `AccountForm`'s Tags field is a plain
  comma-separated text input rather than an add/remove chip widget, since no such
  component exists yet in `ui-kit` and building one was out of this phase's scope.
  Functionally correct (produces the same `string[]`) but a rougher edit experience
  than a dedicated widget would give.
- **`OpportunitiesTab`/`QuotationsTab` are read-only summaries**, not full embedded list
  views with inline create/edit — the task said "reuse ... just scoped," and neither
  module exposes an embeddable, account-scoped list+CRUD component as-is; building one
  would have meant modifying `opportunities`/`quotations` feature code, which the task's
  explicit "do NOT rebuild Leads/Pipeline/Contacts/Products/Quotations" instruction
  argues against. Create/edit for both is one click away via the existing
  Pipeline/Quotes screens, pre-filled with the account's id where that screen already
  supports it (`/crm/quotes/new?accountId=`, confirmed pre-existing).

## 10. Phase 1B implementation record (status-queue UI + Cold Calling Status + Yet to Happen)

### 10.1 Legacy investigation (per-screen, with evidence)

All 6 legacy files live under `TexaWave_ERP/src/modules/crm/`. Five of the six (Interested,
Not Interested, Keep in Touch, Call Back-Send Info, and the shared queue they're built on)
are thin wrappers around one shared component:

- **`domain/AccountStatusQueue.tsx`** (the shared component, lines 1-5): "Each of these tabs
  is a filtered, read/write view over the same `crm/accounts` Core Domain records (filtered
  by `statusTag`)". Line 53-55: `accounts.filter((a) => a.statusTag && tags.includes(a.statusTag))`
  — confirms the filter key is **`Account.statusTag`**, never `Lead.status`. Row actions
  (lines 173-198): View (navigate to account), conditional Complete/Mark Sent (if an open
  task exists), and `StatusTagDialog` ("Change Status"), reusing the exact same dialog the
  Accounts list and Account-360 page use. Search (line 72-80) is client-side over
  name/owner/statusReason/statusInfoType; no server-side pagination beyond the in-memory
  `usePagination` hook (RTDB has no query pagination).
- **`Interested.tsx`** (lines 8-16): `<AccountStatusQueue tags={['Interested']} .../>`.
- **`KeepInTouch.tsx`** (lines 8-16): `tags={['Keep in Touch']}`.
- **`NotInterested.tsx`** (lines 10-19): `tags={['Not Interested']}`.
- **`CallBackSendInfo.tsx`** (lines 8-17): `tags={['Call Back', 'Send Info']}` — **confirmed
  a single combined screen, two tags, not two routes** — comment: "a single, unified
  operational queue ... each clearly labeled by its Type column."
- **`ColdCallingStatus.tsx`** (lines 1-7): **NOT** an Account/statusTag filter at all —
  confirmed by reading the full file. It is an **independent dataset** (own Firebase path
  `crm/coldCallingStatus`, its own `ColdCallingRow` shape: `serialNo/date/companyName/
prospectName/designation/status`), with its own CRUD, search/status/date-range filters
  (lines 270-283), bulk import/export (`ImportExportBar`, lines 367-389), ad-hoc custom
  fields (lines 247-260), and Recycle-Bin-routed soft delete (admin-only, line 518). The
  **only** bridge to the Account.statusTag queues is explicit, per-row, and two-step:
  "Link Account" (lines 197-237, name-match-or-create against the real Account dataset) then
  "Route Status" (lines 503-515, the same `StatusTagDialog` component), which writes a
  `dispositionTag`/`dispositionAt` onto the Cold Calling row itself (lines 239-242) —
  never automatic, never a join. This directly confirms the task's own hint: a truly
  separate entity, not a Lead/Account filter.
- **`YetToHappen.tsx`** (lines 1-6, 56-86): a **cross-entity** aggregation of three existing
  entities — `tasks.filter(t => t.status === 'Open')`, `followUps.filter(f =>
['PENDING','OVERDUE'].includes(getEffectiveFollowUpStatus(f)))`, and
  `meetings.filter(m => !['COMPLETED','CANCELLED'].includes(m.status))` — **all three**, not
  meetings-only or follow-ups-only. Sub-tabs: All/Follow-ups/Tasks/Meetings with live counts
  (lines 42-43, 98-108). Row actions: View (resolves back to the owning Account via
  `resolveAccountId`, lines 90-96, 127-131), Complete, and Cancel (follow-ups/meetings only —
  Tasks have no Cancel in legacy's `CrmTaskStatus`, matching the new repo's
  `CRM_TASK_STATUSES = ["Open", "Completed"]`).

### 10.2 The 5 status-tag queues — implementation

Reused, unchanged: `Account.statusTag` field, `AccountsService.changeStatusTag`,
`PATCH /crm/accounts/:id/status-tag`, `ACCOUNT_STATUS_TAGS`,
`changeAccountStatusTagSchema`, and the existing `StatusTagDialog`
(`apps/ui/src/features/crm/accounts/components/StatusTagDialog.tsx`) — **no backend
change was needed or made** for these 5 queues.

New:

- `apps/ui/src/features/crm/accounts/components/AccountStatusQueueList.tsx` — the shared
  component (mirrors legacy `AccountStatusQueue`). Takes 1 or 2 `AccountStatusTag`s. One
  known, documented divergence from true server-side pagination: `GET /crm/accounts`'
  `statusTag` query param accepts exactly one value
  (`apps/api/src/modules/crm/accounts/dto/account.dto.ts` `QueryAccountDto.statusTag?:
AccountStatusTag`; `AccountsRepository.findMany`'s `filterWhere` does a plain equality
  clause, not an `IN`), so a 2-tag queue (Call Back/Send Info) cannot be server-paginated as
  one call. Rather than adding an `IN`-filter to the shared Accounts list endpoint (a
  behavior change to a shared, already-shipped endpoint, out of this phase's "do not add
  backend logic beyond a justified gap" instruction), the component issues one bounded
  fetch per tag (`limit: 200`) and merges/paginates client-side. Documented as a scale
  limit: if any one status tag ever holds more than 200 accounts, this queue's pagination
  undercounts. Flagged as a gap below, not silently accepted.
- Thin per-queue wrappers: `InterestedQueue.tsx`, `KeepInTouchQueue.tsx`,
  `NotInterestedQueue.tsx`, `CallBackSendInfoQueue.tsx` (all in the same
  `accounts/components/` folder) — each just supplies `tags`/`title`/`description`.
- Routes: `apps/ui/src/app/(dashboard)/crm/{interested,keep-in-touch,not-interested,
callback-send-info}/page.tsx` — thin, import-only, per `Docs/CODING_STANDARDS.md` §4.
- Row actions wired: **View** (`router.push` to `/crm/accounts/:id`), **Change Status**
  (existing `StatusTagDialog` + `useChangeAccountStatusTag`, server-validated via
  `AccountsService.changeStatusTag`'s `assertStatusTagFieldsPresent`). Legacy's
  Complete/Mark Sent button (tied to an open `CrmTask`) was **not** reproduced — the new
  repo's Accounts list doesn't surface an account's open task inline either, and adding it
  would mean a third parallel bulk-fetch (Tasks) per queue purely for a convenience button;
  flagged as a gap, not silently dropped.

### 10.3 Yet to Happen — implementation

**No backend change was needed.** Verified directly in the repository filters:
`apps/api/src/modules/crm/{tasks,follow-ups,meetings}.repository.ts`'s `filterWhere` only
adds a `relatedId`/`relatedType` clause `if (filter.X !== undefined)` — omitting them from
the query already returns every one of the org's rows (tenant-scoped via `tenantWhere`).
So `GET /crm/tasks?status=Open`, `GET /crm/follow-ups`, `GET /crm/meetings` with no
`relatedId` already serve exactly what this queue needs.

- `apps/ui/src/features/crm/yet-to-happen/components/YetToHappenList.tsx` — fetches all 3
  entity lists bounded (`limit: 200` each), filters client-side to the same effective-status
  rules as legacy (`CrmTask.status === "Open"`; `FollowUp.effectiveStatus` is
  `"PENDING"`/`"OVERDUE"` — reusing the server-computed field documented in
  `follow-ups.service.ts`, never re-deriving it client-side; `Meeting.status` not in
  `COMPLETED`/`CANCELLED`), merges, sorts by due date, and renders All/Follow-up/Task/Meeting
  sub-tabs with counts.
- Account-name resolution: for `relatedType === "account"` rows, a bulk `useAccounts({limit:
200})` id→name map; for `relatedType === "contact"`/`"opportunity"` rows, `Contact`/
  `Opportunity`'s wire types already embed `account: Pick<Account,"id"|"name">`
  (`packages/api-types/src/crm-{contacts,opportunities}.ts`), so a bulk `useContacts`/
  `useOpportunities` fetch resolves those without any new backend join. `relatedType ===
"lead"` rows are not resolved to an account (leads have none) — shown without a View link,
  matching legacy's own `if (item.relatedType === 'lead') return
/crm/leads/${id}` branch being the one case this port did not add a Leads-detail link for
  (gap, see below).
- Row actions wired: **Complete** (`useUpdateCrmTaskStatus`/`useUpdateFollowUpStatus`/
  `useUpdateMeetingStatus` → real `PATCH` calls), **Cancel** (follow-ups/meetings only, no
  Cancel for Tasks — matches `CRM_TASK_STATUSES`), **View** (only when an account was
  resolved).
- Route: `apps/ui/src/app/(dashboard)/crm/yet-to-happen/page.tsx`.

### 10.4 Cold Calling Status — implementation

Confirmed in §10.1 this is a genuinely separate entity, not an Account/statusTag filter, so
unlike every other queue in this phase, implementing it **required new backend code** — the
one case flagged by the task as justified. Added, following the exact Prisma model →
repository → service → controller → DTO → api-types → zod → feature pattern every other CRM
entity in this codebase already uses (closest precedent: `CrmNote`, the simplest existing
CRM CRUD entity):

- **Schema**: `CrmColdCallingEntry` model in `packages/database/prisma/schema.prisma`
  (`serialNo`, `callDate`, `companyName` (required), `prospectName`, `designation`,
  `status` (free text, never an enum, matching legacy's own comment on why), optional
  `linkedAccountId` FK to `Account`, `dispositionTag`/`dispositionAt`, standard audit/
  soft-delete columns). Migration:
  `packages/database/prisma/migrations/20261012170000_add_crm_cold_calling_entries/
migration.sql`. Applied to **both** the dev DB (`texawave_erp`) and the disposable
  `texawave_erp_test` DB via `prisma migrate deploy` (not `migrate dev` — see §10.6 for why).
- **Backend**: `apps/api/src/modules/crm/cold-calling/{cold-calling.{controller,service,
repository,module}.ts, dto/cold-calling.dto.ts}`. Routes: `GET/POST /crm/cold-calling-
entries`, `GET/PATCH /crm/cold-calling-entries/:id`, `POST /crm/cold-calling-entries/:id/
link-account` (validates the target account exists in-org, mirrors legacy
  `handleLinkAccount`'s field-write side), `POST /crm/cold-calling-entries/:id/disposition`
  (records which tag a row was routed to — informational only; the actual
  `Account.statusTag` write happens through the **existing, unmodified**
  `PATCH /crm/accounts/:id/status-tag`, exactly mirroring legacy's two-call
  `handleLinkAccount` → `StatusTagDialog` → `handleDispositionRecorded` flow), `DELETE
/crm/cold-calling-entries/:id`. Registered in `apps/api/src/app.module.ts`.
- **Permissions**: `crm.coldcalling.{read,write,delete}` added to
  `packages/database/prisma/permissions/catalog.ts`, same single-tier admin-only `.delete`
  shape as every other CRM entity's permissions.
- **Contracts**: `packages/api-types/src/crm-cold-calling.ts` (wire types),
  `packages/core/src/schemas/crm-cold-calling.schema.ts` (`createColdCallingEntrySchema` /
  `updateColdCallingEntrySchema` / `linkColdCallingEntrySchema`, mirroring the DTOs).
- **UI**: `apps/ui/src/features/crm/cold-calling/{api.ts,hooks.ts,components/
{ColdCallingList.tsx,ColdCallingEntryDialog.tsx}}`. Route:
  `apps/ui/src/app/(dashboard)/crm/cold-calling-status/page.tsx`. Row actions wired: **Add**/
  **Edit** (real create/update calls), **Link Account** (client-side name match against a
  bulk `useAccounts` fetch, same matching precedent as `AccountStatusQueueList`; creates a
  new Account via the existing `useCreateAccount` if no name match — simplified vs legacy's
  name→website→email fallback chain, a documented gap below), **Route Status** (the
  existing, unmodified `StatusTagDialog` + `useChangeAccountStatusTag`, followed by
  `useRecordColdCallingDisposition`), **Delete** (real soft-delete call).
- **Menu**: `crm-cold-calling-status` entry, gated on `crm.coldcalling.read`.

### 10.5 Menu entries added

All in `packages/database/prisma/menu/catalog.ts`, `parentCode: "crm"`, ordered after the
existing 6 CRM items, following legacy's own CRM module ordering: `crm-interested` (order 7,
`crm.account.read`), `crm-not-interested` (8, `crm.account.read`), `crm-keep-in-touch` (9,
`crm.account.read`), `crm-callback-send-info` (10, `crm.account.read`),
`crm-cold-calling-status` (11, `crm.coldcalling.read`), `crm-yet-to-happen` (12,
`crm.followup.read` — the most central of the 3 entity kinds the queue surfaces; each
underlying list still separately enforces `crm.task.read`/`crm.followup.read`/
`crm.meeting.read` at the API layer regardless of which one gates the menu entry). Synced
via `menu:sync` to both `texawave_erp` and `texawave_erp_test` — confirmed via the sync
tool's own `--check` validation (49 items, valid) and its applied-items output (all 6 new
codes listed as `created` for every organization in both databases).

### 10.6 An unplanned, encountered-but-not-fixed blocker: broken shadow DB + a pre-existing permission-catalog conflict

- **`prisma migrate dev` is currently broken** for this repository, unrelated to this phase:
  the shadow-database replay fails with `P3006` on migration
  `20261009053057_add_hr_payroll_loan_bonus_candidate` ("relation `payroll_periods` already
  exists" on an empty shadow DB — i.e. an earlier HR migration in the existing chain already
  creates that table, so replaying the full chain from scratch double-creates it). This
  predates this phase (confirmed: `git diff --stat` on `schema.prisma` before this phase's
  edit showed 0 changes to any existing migration). Worked around by hand-authoring
  `20261012170000_add_crm_cold_calling_entries/migration.sql` (verified by eye against
  `packages/database/prisma/schema.prisma`'s new model) and applying it with `prisma migrate
deploy`, which does not use a shadow DB — confirmed applied cleanly to both `texawave_erp`
  and `texawave_erp_test`. **Not fixed**: fixing the underlying HR migration-chain
  corruption is a separate, unrelated-module task and explicitly out of this phase's scope.
- **`packages/database/prisma/permissions/catalog.ts` has a pre-existing, unrelated
  duplicate-entry conflict** that blocks `permissions:sync`/`permissions:check` entirely
  (the validator checks the whole catalogue atomically, so one conflict blocks every
  permission in the file, including the 3 new `crm.coldcalling.*` ones added in this phase).
  Confirmed by reading the file directly: `hr.payroll.read`/`hr.payroll.write`,
  `hr.loan.read`/`hr.loan.write`, and `hr.bonus.read`/`hr.bonus.write` are each expanded via
  `scopedPermission(...)` **twice**, at two different call sites with two different
  surrounding comments (lines ~444-452 vs ~461-470 for payroll; ~426-430 vs ~488-493 for
  loan; ~433-437 vs ~496-498 for bonus) — not an exact copy-paste (the two sites grant
  different _additional_ permissions alongside the shared read/write, e.g. `.credit` vs
  `.approve`/`.finalize`), so this reads as two different past HR phases that each
  independently (re-)added the same base permission pair. **Not fixed** — resolving which of
  the two additions is canonical is an HR-module judgment call with no bearing on CRM, and
  explicitly out of this phase's scope ("do not modify unrelated modules"). **Consequence**:
  `crm.coldcalling.read`/`.write`/`.delete` permission rows could **not** be seeded into
  either `texawave_erp` or `texawave_erp_test` this session. The Cold Calling Status feature
  is fully implemented and gated correctly in code, but **no user in any environment can
  currently be granted access to it** until this pre-existing, unrelated catalogue conflict
  is resolved by someone scoped to touch HR permissions. This is the single most important
  gap in this phase's delivery — flagged here prominently rather than left to be discovered
  later. (The 5 status-tag queues and Yet to Happen are unaffected: they reuse
  `crm.account.read`/`crm.followup.read`, which were already synced by earlier phases before
  this conflict existed.)

### 10.7 Verification actually performed (and what was NOT verified)

- `pnpm --filter @texawave-erp/database run build` — **pass**.
- `pnpm --filter @texawave-erp/database run typecheck` — **pass**.
- `pnpm --filter @texawave-erp/database run lint` — **pass**.
- `pnpm --filter @texawave-erp/core run typecheck` — **pass**.
- `pnpm --filter @texawave-erp/core run lint` — **pass**.
- `pnpm --filter @texawave-erp/api-types run typecheck` — **pass**.
- `pnpm --filter @texawave-erp/api-types run lint` — **pass**.
- `pnpm --filter api run typecheck` — **pass**.
- `pnpm --filter api run lint` — **pass**.
- `pnpm --filter ui run typecheck` — **pass** (after fixing one `exactOptionalPropertyTypes`
  mismatch on `ColdCallingEntryDialogProps.initialValues`).
- `pnpm --filter ui run lint` — **pass** (after fixing one `no-unused-vars` warning on an
  unused `SUB_TABS` const in `YetToHappenList.tsx`).
- `pnpm --filter ui run build` (Next.js production build, Turbopack) — **pass**; all 6 new
  routes (`/crm/interested`, `/crm/keep-in-touch`, `/crm/not-interested`,
  `/crm/callback-send-info`, `/crm/cold-calling-status`, `/crm/yet-to-happen`) appear in the
  route manifest as static (`○`).
- `prisma migrate deploy` against both `texawave_erp` and `texawave_erp_test` — **pass**,
  new migration applied cleanly to both.
- `menu:sync` against both databases — **pass**, all 6 new menu codes created for every
  organization in both databases; `menu:sync-cli --check` reports the catalogue valid (49
  items).
- `permissions:sync`/`permissions:check` — **could not run** (pre-existing, unrelated
  catalogue conflict — see §10.6). The 3 new `crm.coldcalling.*` permission codes exist in
  the catalogue file and are referenced correctly by the new controller's
  `@RequirePermission` decorators, but are **not seeded** in any database this session.
- e2e regression: see below for the actual run; **no new backend e2e test was added** for
  Cold Calling Status specifically despite it being new backend code, because the
  permission-sync blocker in §10.6 means no role in the test database can currently be
  granted `crm.coldcalling.*`, so an e2e test exercising its endpoints would either have to
  bypass the permission guard (defeating the point of an e2e test) or fail for a reason
  unrelated to the code under test. This is itself a consequence of §10.6, not a separate
  omission — flagged rather than worked around with a shortcut.
- **No real browser-automation tool was available in this session.** Nothing above
  constitutes interactive UI verification. No page was rendered in a browser, no click/
  submit flow was exercised against a running UI+API pair, no screenshot was taken. The
  "build succeeds"/"typecheck and lint are clean" results prove the code compiles and is
  internally type-consistent against the real `api-types`/DTO/Prisma contracts — they do
  not prove any dialog opens correctly, any form submits successfully against a live API,
  any React Query cache invalidation actually refreshes the right list, that the two-tag
  client-merge-and-paginate logic in `AccountStatusQueueList` behaves correctly against real
  data, or that any visual layout is usable. This applies equally to every component built
  in §10.2-10.4.

### 10.8 Explicitly deferred / known gaps

- **`crm.coldcalling.*` permissions not seeded in any database** — see §10.6. The most
  significant gap; blocks live use of Cold Calling Status until resolved by an HR-scoped fix
  to the permissions catalogue.
- **Call Back/Send Info's 2-tag merge is client-paginated with a 200-row-per-tag bound**,
  not true server-side pagination (see §10.2) — a scale gap, not a correctness gap, for any
  organization with over 200 accounts in one status tag.
- **No Complete/Mark Sent convenience button** on the 4 status-tag queues (legacy ties this
  to an account's open `CrmTask`) — dropped rather than adding a 4th bulk-fetch per queue for
  a convenience action; the same outcome is reachable via the Account-360 Tasks tab.
- **Cold Calling's account-matching on Link Account is name-only**, not legacy's
  name→website→domain→email fallback chain — a narrower, more conservative version of the
  same idea (match by exact name, else create), since the new repo's Accounts list has no
  website/domain-based lookup endpoint to reuse without adding one.
- **No bulk import/export, no ad-hoc custom fields, no Recycle Bin integration** for Cold
  Calling Status — legacy has all three (`ImportExportBar`, `useCrmCustomFields`,
  `softDeleteCrmRecord`); none exist as reusable primitives in this codebase yet, and
  building them was out of this phase's scope (the task named only the 6 queue screens).
  Delete here is a direct hard soft-delete (`deletedAt`), not Recycle-Bin-routed.
  `linkedAccountId` is a hard delete, not a true polymorphic `relatedType`/`relatedId` like
  Meeting/FollowUp/etc — correct, since a Cold Calling row only ever points at an Account
  (never a Contact/Opportunity/Lead), matching legacy exactly.
- **Yet to Happen's `relatedType === "lead"` rows have no View link** — legacy links to
  `/crm/leads/:id`. Confirmed `apps/ui/src/app/(dashboard)/crm/leads/` has only a list
  `page.tsx`, no `[id]` detail route in this repo yet — so there is nothing to link to today;
  not a regression introduced by this phase.
- **`prisma migrate dev`'s broken shadow database (§10.6) is unfixed** — any future phase
  adding a migration will hit the same `P3006` and need the same `migrate deploy` + hand-
  authored-SQL workaround until someone repairs the migration chain.

## 11. Phase 1B verification follow-up: permission-catalog fix, seeding, full e2e regression, Cold Calling auth coverage

Follow-up session scoped only to closing the gaps flagged in §10.6-10.8 (the catalogue
conflict that blocked `crm.coldcalling.*` seeding, and the missing Cold Calling e2e
coverage). No new CRM feature work, no Phase 1C.

### 11.1 The duplicate-permission fix (§10.6)

Confirmed by reading `packages/database/prisma/permissions/catalog.ts` directly: two call
sites each `scopedPermission(...)`-expanded the same six base codes
(`hr.payroll.read`/`.write`, `hr.loan.read`/`.write`, `hr.bonus.read`/`.write`), tripped by
`validate.ts`'s exact-code `seen.has(code)` check (18 colliding `.own`/`.team`/`.all` rows).

Traced which site is actually enforced by the running code (`apps/api/src/modules/hr/
payroll/{loans,bonuses,periods,runs}/*.controller.ts` — grepped every
`@RequireScopedPermission`/`const … = "hr…"` call site): only the **second** site (originally
~lines 460-509, comment `apps/api/src/modules/hr/payroll — team-scoped`) is checked by any
controller/service — it is the one with `hr.payroll.approve`/`hr.payroll.finalize`,
`hr.loan.approve`, `hr.bonus.approve` as separate codes, matching `loans.controller.ts`,
`bonuses.controller.ts`, `payroll-periods.controller.ts`, `payroll-runs.controller.ts`
exactly. The **first** site (originally ~lines 425-452, comments referencing
`apps/api/src/modules/hr/loans`/`hr/bonuses` — directories that do not exist; the real code
lives under `hr/payroll/loans`/`hr/payroll/bonuses`) baked approve/reject semantics into its
`.write` description instead of a separate `.approve` code, and introduced `hr.payroll.credit`
— confirmed by grep to be checked by **zero** controllers/services anywhere in `apps/api/src`;
the actual "mark payslip credited" flow runs through `hr.payment.write`
(`apps/api/src/modules/hr/payroll/payments`), not a dedicated credit permission.

**Fix applied** (pure dedup/consolidation, no functionality change):

- Deleted the entire first (stale, superseded, unused-module-path) block: the duplicate
  `hr.loan.read`/`.write`, `hr.bonus.read`/`.write`, `hr.payroll.read`/`.write`
  registrations and their surrounding comment.
- Preserved `hr.payroll.credit` (the one code from that block that was NOT a duplicate, per
  the task's "do not remove any HR payroll/loan/bonus permission" constraint) by moving its
  `scopedPermission(...)` call into the second (real, enforced) payroll block, immediately
  after `hr.payroll.finalize`, with a comment explaining it is carried over, unused by any
  controller today, and kept seeded rather than deleted.
- Net effect: the six duplicate base codes now exist exactly once each, carrying the second
  block's descriptions (the ones that match the actually-implemented `.approve`/`.finalize`
  separation); every other permission in the file, including all of block 2's `.approve`/
  `.finalize` codes and the `hr.salary.*`/`hr.pf.*`/`hr.esi.*`/`hr.payslip.*`/`hr.payment.*`
  codes alongside it, is untouched.

### 11.2 Validation and seeding results

- `pnpm --filter database run permissions:check` — **pass**: `Catalogue valid: 262
permissions, 0 retired.`
- `pnpm --filter database run permissions:sync` against `texawave_erp` (dev) — **pass**.
  Created 75 rows (incl. `crm.coldcalling.read`/`.write`/`.delete` and the rest of the Phase
  0/1A/1B CRM permissions that had never been seeded either, plus the now-reachable
  `hr.payroll.approve/finalize`, `hr.loan.approve`, `hr.bonus.approve`, `hr.salary.*`,
  `hr.pf.*`, `hr.esi.*`, `hr.payslip.read`, `hr.payment.*` rows); updated 15 (the
  consolidated `hr.payroll.read/write`, `hr.loan.read/write`, `hr.bonus.write` descriptions,
  now matching the single surviving registration); 0 deactivated; 172 unchanged. One
  pre-existing orphan reported (`testaudit.probe.write`, untouched, not part of this fix).
- `pnpm --filter database run permissions:sync` against `texawave_erp_test` (disposable) —
  **pass**. Created 39, updated 51, 0 deactivated, 172 unchanged. Orphans reported (left
  untouched): `testaudit.probe.write`, `crm.contact.read`, `crm.contact.write` (both
  pre-existing rows from an earlier phase's own ad-hoc seeding, unrelated to this fix).
- Confirmed directly: `crm.coldcalling.read`/`crm.coldcalling.write`/`crm.coldcalling.delete`
  are now present and active in **both** databases — the single most important gap from
  §10.6/§10.8 is closed.

### 11.3 Infrastructure health

Docker Desktop was not running at session start (`docker ps` failed to reach the daemon).
Located the per-user install (`C:\Users\DHANUSH\AppData\Local\Programs\DockerDesktop\Docker
Desktop.exe`, not the usual Program Files path) and started it; the daemon came up within
~10s with the `postgres`/`redis` containers already present from the prior session and
reaching `healthy` within another ~30s. `texawave_erp`, `texawave_erp_test` and
`texawave_erp_shadow_test` databases all confirmed present via `psql -U texawave -lqt`. No
`migrate reset`, no data reset — only the additive `permissions:sync` writes in §11.2 were
applied.

### 11.4 Full e2e regression results

Ran the **entire** backend e2e suite (not just CRM — the filename args passed to `pnpm
--filter api test:e2e -- <names>` were not honored as a file filter by this project's vitest
invocation, so it ran all 47 `*.e2e-spec.ts` files) against `texawave_erp_test` with
`REDIS_URL` on DB index 5, per the suite's own safety guard:

- **Test Files: 46 passed, 1 failed (47 total). Tests: 1221 passed, 2 failed (1223 total).**
  Duration ~1087s.
- The 1 failing file is `test/hr-attendance-auto-checkout.e2e-spec.ts`, 2 tests ("writes
  exactly one audit row as a system actor with no user", "repeated execution makes no
  further change"), both failing with `Error: Test timed out in 5000ms` — an HR attendance
  module test, completely unrelated to CRM or to this session's permission-catalog fix, and
  a timeout (not an assertion failure), consistent with environment/resource contention
  rather than an application bug. Not re-run to confirm infra-vs-app, per scope: this phase
  is CRM-only and the failure is outside it; flagged here rather than silently ignored.
- **All 7 pre-existing CRM e2e suites passed** as part of that full run:
  `crm-accounts`, `crm-contacts`, `crm-leads`, `crm-meetings`, `crm-opportunities`,
  `crm-products`, `crm-quotations` — none appear in the failed-tests list.
- To isolate and double-confirm the CRM result (and specifically exercise the new Cold
  Calling spec in the same breath), re-ran just the 8 CRM spec files directly via
  `npx vitest run --config ./vitest.config.e2e.ts test/crm-*.e2e-spec.ts` against the same
  disposable database: **8 test files passed (8), 105 tests passed (105)**, ~158s. This is a
  clean, isolated, actually-observed pass — not inferred from the full-suite run alone.
- This supersedes §10's incomplete run (prior session's Docker crash mid-run); the CRM
  regression suite has now been run to completion and is green, and the pre-existing
  `hr-attendance-auto-checkout` failure is newly surfaced but is an unrelated HR module
  issue, not a CRM regression.

### 11.5 Cold Calling authorization/isolation test — added and passing

No e2e spec existed for `apps/api/src/modules/crm/cold-calling/` (§10.7 confirmed this was
because permissions weren't seeded; now that §11.2 has seeded them, the gap is closed).
Added `apps/api/test/crm-cold-calling.e2e-spec.ts`, modeled directly on
`crm-meetings.e2e-spec.ts`'s conventions (self-contained org/role/user bootstrap via
`permission.upsert` + ad-hoc role, `beforeAll`/`afterAll`, random-slug orgs per run). Covers:

- Unauthenticated (401) and unauthorized/no-permission (403) rejection on list and create.
- Create, then tenant-isolated read (org B gets 404 on org A's entry; org A gets 200).
- Update, including cross-org update rejected with 404.
- `link-account`: rejects linking to a non-existent account (422, via
  `BusinessRuleViolationException`), accepts linking to an in-org account (201,
  `linkedAccountId` set correctly).
- `disposition`: records a disposition tag and timestamps `dispositionAt`.
- Soft-delete: cross-org delete rejected (404), own-org delete succeeds (204), then the
  entry 404s on subsequent read; tenant isolation holds throughout.

Result: **6/6 tests pass** (part of the 8-file/105-test clean run in §11.4).

### 11.6 Remaining gaps / limitations after this follow-up

- `prisma migrate dev`'s broken shadow database (§10.6) is still unfixed — unrelated to
  permissions, out of scope for this follow-up too; any future migration still needs the
  `migrate deploy` + hand-authored-SQL workaround.
- `hr.payroll.credit` remains seeded but checked by no controller anywhere in `apps/api/src`
  — preserved rather than removed per this task's explicit no-removal constraint, but it is
  dead/reserved metadata, not wired to any endpoint. Worth a decision by whoever owns the
  payments/payroll module on whether to wire it up or formally retire it (via
  `RETIRED_PERMISSIONS`) in a future, HR-scoped change — out of scope here.
- `hr-attendance-auto-checkout.e2e-spec.ts`'s 2 timeout failures (§11.4) are unexplained and
  unrelated to CRM — flagged for whoever owns the HR attendance module, not investigated
  further here (out of this phase's scope).
- Everything else flagged in §10.8 (Cold Calling's name-only account matching, no bulk
  import/export, no Recycle Bin integration, Call Back/Send Info's 200-row client pagination
  bound, the missing Leads detail-page link, and no FollowUps/Activities/CrmTasks/Documents/
  CrmNotes-specific e2e suites beyond the Meetings representative) is unchanged by this
  follow-up — none of it was in scope.
- No UI/browser verification was performed in this follow-up either (backend-only scope:
  permission catalog, seeding, e2e).
