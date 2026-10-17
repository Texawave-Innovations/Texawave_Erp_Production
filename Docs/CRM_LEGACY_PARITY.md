# CRM Legacy Parity Matrix

**Status:** Accounts, Contacts, and Leads are implemented end-to-end (schema, permissions, API,
e2e tests, UI). Every other CRM screen is audited only at the structural level (Phase A survey) —
not yet feature-audited one-by-one. Kept intentionally concise per the ~1-day scope; expand a
section to the HR doc's 16-point depth only immediately before implementing it.
**Legacy source (read-only):** `D:\New folder\TexaWave_ERP` (Vite/React, Firebase RTDB). Not
modified.
**Production source:** `D:\New folder\Texawave_Erp_Production` (NestJS + Prisma + PostgreSQL +
Next.js), branch `feature/HR`.
**Methodology:** mirrors `Docs/HR_LEGACY_PARITY.md`. _Confirmed_ = directly observed in legacy
code. _Deferred_ = legacy feature exists but has no production entity to attach to yet (named
explicitly so it isn't silently dropped).

---

## 1. Architectural findings

| #   | Finding                                                                                                                                                                                                               | Evidence                                                                     | Consequence                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | The entire legacy CRM tree was copied verbatim into `apps/api/src/modules/crm/*` as **reference-only** material — raw Firebase/react-router code, excluded from the TS build (`tsconfig.json`/`tsconfig.build.json`). | File inspection; exclude lists                                               | Do not "fix" these files into compiling — they are read for behavior, never shipped as-is.                                                                                                                                                       |
| F2  | Legacy stores all CRM data in **Firebase RTDB**, not a relational DB; all business logic lives in the browser (`Leads.tsx`, `LeadConvertDialog.tsx`, etc.).                                                           | `ref(database, …)` across `src/modules/crm`                                  | Legacy is a behavior reference only; schema is designed fresh per entity.                                                                                                                                                                        |
| F3  | Legacy's CRM Delete is gated behind **"CRM Admin" only** (`isCrmAdmin` → `user.role === 'admin'`), not by record ownership — see `domain/roles.ts`/`recycleBinService.ts`.                                            | `assertCrmAdmin`, `isCrmAdmin`                                               | Production has no separate "CRM admin" role concept yet. Contacts already set the precedent: gate delete behind the `.write` permission instead. Leads follows the same precedent.                                                               |
| F4  | Legacy's Lead → Account/Contact/**Deal** conversion (`domain/LeadConvertDialog.tsx`) also creates an Opportunity on a Pipeline board.                                                                                 | `createCrmOpportunity` call in `LeadConvertDialog.tsx`                       | **Deferred.** Pipeline/Opportunities has no production entity yet. Lead conversion in production creates/links an Account and optionally a Contact only; Deal creation is explicitly out of scope until Pipeline/Opportunities is its own phase. |
| F5  | Legacy's Leads list derives "Rating" / "Touched" / "Last Activity" filter columns from a CRM-wide audit-log + Activities/Meetings/Follow-ups feed (`domain/useCrmDomainData`, `intelligence/auditService`).           | `Leads.tsx` `touchedIds`/`lastActivityById` memos                            | **Deferred.** That cross-entity activity feed doesn't exist in production. Omitted from the Lead API/UI for now; add only once Activities/Meetings/Follow-ups are themselves migrated.                                                           |
| F6  | Production already has: `Account`, `Contact` (Phase 4B — org-wide reference data, `crm.account.*`/`crm.contact.*` permissions, full NestJS+Next.js stack).                                                            | `schema.prisma` `crm` schema; `apps/api/src/modules/crm/{accounts,contacts}` | Lead reuses `Account`/`Contact` directly rather than re-modeling them.                                                                                                                                                                           |
| F7  | No Postgres enum type exists anywhere in this schema; every status/priority field elsewhere is a validated `String`.                                                                                                  | `grep "^enum " schema.prisma` → no matches                                   | `Lead.leadStatus`/`priority` are `String`, validated with `@IsIn()` at the DTO layer — consistent with the rest of the codebase, not a special case.                                                                                             |

---

## 2. Feature audit — Leads (implemented this phase)

1. **Location:** `modules/crm/Leads.tsx` (990 lines), `LeadDetail.tsx`, `domain/LeadConvertDialog.tsx`; RTDB `crm/leads`.
2. **Data:** `LeadsRow` (`modules/crm/types.ts`) — ~30 fields across Lead Info / Company / Contact / Meeting / Address / Qualification / Requirement sections. All free-text in legacy (a Firebase sheet row).
3. **Workflow:** create → edit any field inline (save-on-blur for text, save-on-change for selects) → optionally **Convert** (creates/links Account + Contact + Deal, sets `leadStatus: CONVERTED`, writes an audit entry) → Delete (admin-only, soft delete via Recycle Bin).
4. **Calculations:** none (a tracking sheet, not a calculator).
5. **Production before this phase:** none. After this phase: full CRUD + Convert.
6. **Reusable:** `Account`/`Contact` (Phase 4B) — Convert creates/links these directly, no new model needed for them.
7. **Required backend:** `crm.leads` table; list (search/filter/paginate), create, update, soft-delete, convert.
8. **Models:** `Lead` (`packages/database/prisma/schema.prisma`) — see F4/F5 for what was deliberately left out (`linkedOpportunityId`, `sourceMiningRowId`), and the model's own doc-comment for the `month`-column/`emailOptOut`-type deviations.
9. **APIs:** `GET/POST /crm/leads`, `GET/PATCH/DELETE /crm/leads/:id`, `POST /crm/leads/:id/convert`.
10. **Permissions:** `crm.lead.read.{own,team,all}`, `crm.lead.write.{own,team,all}` (`scopedPermission`, same shape as `crm.contact.*`). Delete and Convert both require `.write` — see F3.
11. **Audit:** generic before/after snapshots on create/update/delete/convert via the existing `AuditWriter` (same mechanism as Account/Contact) — legacy's separate named audit actions (`lead_assigned`, `lead_status_changed`, ...) are not reproduced as distinct event types; this is a simplification, not a gap in coverage.
12. **Scope:** team-scoped (`TeamScoped`, `ownerField: createdBy`) — same convention as Contact; `assignedTo` is kept as a free-text display field, not conflated with the scope-owning user.
13. **Dependencies:** `Account`/`Contact` (via Convert).
14. **Confirmed rules:** `companyName`/`prospectName` required (legacy client-side guard); `leadStatus` defaults to `NEW` on create; 9-value status vocabulary (`LEAD_STATUSES`) reproduced exactly.
15. **Unresolved / deferred:** Deal/Opportunity creation on convert (F4); Rating/Touched/Last-Activity derived columns (F5); Accounts Mining Sheet promotion source (`sourceMiningRowId`) — no production entity for Accounts Mining Sheet either.
16. **Recommendation:** implemented as the first full CRM vertical slice beyond Accounts/Contacts. Next natural step is **Pipeline/Opportunities** (unblocks Deal creation on Lead convert) or **Products** — see §3.

---

## 3. Suggested next CRM target

**Pipeline/Opportunities** is the highest-value next slice: it unblocks the Deal half of Lead
conversion (F4) and is the direct next stage of the funnel Accounts → Contacts → Leads already
built. Alternative: **Products**, which Opportunities/Quotes both depend on but which has no
other prerequisite. Both are reference-only today (`modules/crm/Pipeline.tsx`, `Products.tsx`,
`domain/opportunitiesService.ts`, `domain/productsService.ts`) — a 16-point audit per the HR
template is the right first step before modeling either.

Remaining CRM surface (not yet feature-audited): Deals/Pipeline, Products, Quotes/Quotations,
Quotas, Accounts Mining Sheet, dashboard/intelligence/analytics (`OverallData`, `CrmDashboard`),
calendar, notifications, celebration effects, bulk import/export, recycle bin, cold-calling /
WhatsApp / LinkedIn / call-back outreach sheets.
