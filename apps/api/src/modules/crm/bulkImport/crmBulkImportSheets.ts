// CRM Bulk Import — sheet-name detection + per-sheet field/commit configuration. The central
// registry `CrmBulkImport.tsx` uses to route each sheet of an uploaded workbook to the right CRM
// module, reusing each module's own existing FieldSchema/commit pattern wherever one already
// exists (Leads, Accounts Mining Sheet — both already have their own single-sheet Bulk Import
// wired up via `ImportExportBar`) instead of re-deriving it, and defining a matching schema only
// for the sheets that don't yet have one (Call Back-Send Info, Not Interested, Keep in Touch, Yet
// to Happen). Those four don't write into a flat collection of their own — per `AccountStatusQueue.tsx`
// and `YetToHappen.tsx`, they're filtered views over the unified `CrmAccount.statusTag` / open
// `CrmMeeting` records, so their commit functions write there instead, exactly like changing an
// Account's status from the Account 360 page or Change Status dialog already does.
//
// Dynamic fields: when an Excel header matches no field below (built-in or already-discovered),
// `CrmBulkImport.tsx` auto-creates one via `crmCustomFieldsService.ts` before opening a sheet's
// review dialog. Every module's field list here is the built-in ones plus that module's live
// custom-field defs, merged with `customDefsToFields`, so the new column maps/previews/imports
// exactly like any other field — see `splitCustomFields` for how its value gets nested under
// `record.customFields` instead of a top-level key.
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "@/services/firebase";
import {
  DuplicateConfig,
  DuplicateStrategy,
  FieldSchema,
  ImportSummary,
  MappedImportRow,
} from "../importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "../importExport/commitHelpers";
import { useCrmDomainData } from "../domain/useCrmDomainData";
import {
  createCrmAccount,
  changeCrmAccountStatusTag,
  findPossibleDuplicateAccount,
} from "../domain/accountsService";
import { createCrmContact } from "../domain/contactsService";
import { createCrmMeeting } from "../domain/meetingsService";
import { logCrmActivitySilently } from "../domain/activitiesService";
import { updateInCollection } from "../domain/firebaseCollection";
import { CRM_ACCOUNTS_PATH, MEETING_STATUSES } from "../domain/config";
import { CrmAccount, CrmMeetingStatus } from "../domain/types";
import { LEAD_IMPORT_EXPORT_FIELDS, LEADS_PATH, emptyLeadRow } from "../Leads";
import {
  IMPORT_EXPORT_FIELDS as ACCOUNTS_MINING_FIELDS,
  PATH as ACCOUNTS_MINING_PATH,
  emptyRow as emptyAccountsMiningRow,
} from "../AccountsMiningSheet";
import {
  IMPORT_EXPORT_FIELDS as COLD_CALLING_FIELDS,
  PATH as COLD_CALLING_PATH,
  emptyRow as emptyColdCallingRow,
} from "../ColdCallingStatus";
import { LeadsRow, AccountsMiningRow, ColdCallingRow } from "../types";
import { CrmBulkImportSheetKind } from "./crmBulkImportTypes";
import {
  useCrmCustomFields,
  CrmCustomFieldDef,
} from "./crmCustomFieldsService";

// --- Sheet-name detection ------------------------------------------------------------------------

function normalizeSheetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
}

const SHEET_NAME_TO_KIND: Record<string, CrmBulkImportSheetKind> = {
  "accounts mining sheet": "accountsMining",
  "accounts mining": "accountsMining",
  leads: "leads",
  "yet to happen": "yetToHappen",
  "call back-send info": "callBackSendInfo",
  "call back send info": "callBackSendInfo",
  "not interested": "notInterested",
  "keep in touch": "keepInTouch",
  "cold calling status": "coldCalling",
  "cold calling": "coldCalling",
  "overall data": "overallData",
};

export function detectSheetKind(sheetName: string): CrmBulkImportSheetKind {
  return SHEET_NAME_TO_KIND[normalizeSheetName(sheetName)] ?? "unrecognized";
}

// --- Dynamic (Bulk-Import-discovered) fields -------------------------------------------------------

/** Converts live custom-field defs into `FieldSchema` entries so they map/preview/import exactly
 *  like a built-in field — `custom: true` is what tells `splitCustomFields` below (and every
 *  module's own table/form — see DetailPageBoxes.tsx) to nest the value under `customFields`. */
function customDefsToFields(defs: CrmCustomFieldDef[]): FieldSchema[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    aliases: [d.sourceHeader],
    custom: true,
  }));
}

interface SplitFields {
  /** Every mapped value for a built-in (non-custom) field, unchanged. */
  base: Record<string, unknown>;
  /** `customFields/<key>` -> value — a leaf-path key safe for a per-key RTDB partial `update()`
   *  (deep-merges into whatever `customFields` the record already has, never clobbering sibling
   *  custom values). Only usable where the caller routes through a per-key update loop — never
   *  through a single `set()` of a whole record, since Firebase rejects a literal "/" inside an
   *  object key written that way. */
  customLeaf: Record<string, unknown>;
  /** `<key>` -> value — a plain nested object, safe to embed as `customFields: {...}` only when
   *  writing a brand-new record (`set()`/`push()+set()`), where there's nothing to clobber. */
  customNested: Record<string, string>;
}

function splitCustomFields(
  fields: FieldSchema[],
  data: Record<string, unknown>,
): SplitFields {
  const customKeys = new Set(fields.filter((f) => f.custom).map((f) => f.key));
  const base: Record<string, unknown> = {};
  const customLeaf: Record<string, unknown> = {};
  const customNested: Record<string, string> = {};
  Object.entries(data).forEach(([k, v]) => {
    if (!customKeys.has(k)) {
      base[k] = v;
      return;
    }
    const value = v === undefined || v === null ? "" : String(v);
    if (!value.trim()) return;
    customLeaf[`customFields/${k}`] = value;
    customNested[k] = value;
  });
  return { base, customLeaf, customNested };
}

// --- Field schemas for the four sheets with no existing Bulk Import wiring -----------------------
// (Accounts Mining Sheet and Leads reuse their own tab's existing FieldSchema — see below.)

const CALL_BACK_SEND_INFO_FIELDS: FieldSchema[] = [
  {
    key: "companyName",
    label: "Name of the Company",
    required: true,
    aliases: ["Company Name", "Company"],
  },
  { key: "domain", label: "Domain" },
  { key: "prospectName", label: "Prospect Name" },
  { key: "title", label: "Title" },
  {
    key: "email",
    label: "Email ID",
    type: "email",
    aliases: ["Email id", "Email"],
  },
  { key: "source", label: "Source" },
  { key: "recordDate", label: "Date" },
  {
    key: "responseNotes",
    label: "Response/Comments",
    aliases: ["Response / Comments", "Comments"],
  },
  // Required: every row here becomes a Call Back status change, which requires a follow-up date
  // (see changeCrmAccountStatusTag) — a row missing it can't be actioned, so it's marked invalid.
  {
    key: "statusDate",
    label: "Next Follow-up",
    required: true,
    type: "date",
    aliases: ["Next Follow Up", "Follow-up Date"],
  },
];

const NOT_INTERESTED_FIELDS: FieldSchema[] = [
  {
    key: "companyName",
    label: "Company Name",
    required: true,
    aliases: ["Name of the Company", "Company"],
  },
  { key: "domain", label: "Domain" },
  { key: "prospectName", label: "Prospect Name" },
  { key: "title", label: "Title" },
  {
    key: "email",
    label: "Email id",
    type: "email",
    aliases: ["Email ID", "Email"],
  },
  { key: "source", label: "Source" },
  { key: "recordDate", label: "Date" },
  // Required: Not Interested requires a reason (see changeCrmAccountStatusTag).
  {
    key: "statusReason",
    label: "Response/Comments",
    required: true,
    aliases: ["Response / Comments", "Comments"],
  },
];

const KEEP_IN_TOUCH_FIELDS: FieldSchema[] = [
  {
    key: "companyName",
    label: "Name of the Company",
    required: true,
    aliases: ["Company Name", "Company"],
  },
  { key: "prospectName", label: "Prospect Name" },
  { key: "title", label: "Title" },
  {
    key: "email",
    label: "Email ID",
    type: "email",
    aliases: ["Email id", "Email"],
  },
  { key: "source", label: "Source" },
  { key: "recordDate", label: "Date" },
  {
    key: "responseNotes",
    label: "Response/Comments",
    aliases: ["Response / Comments", "Comments"],
  },
  // Required: Keep in Touch requires a re-engage date (see changeCrmAccountStatusTag).
  {
    key: "statusDate",
    label: "Next Follow-up",
    required: true,
    type: "date",
    aliases: ["Next Follow Up", "Follow-up Date"],
  },
];

const YET_TO_HAPPEN_FIELDS: FieldSchema[] = [
  { key: "meetingStatusRaw", label: "Meeting Status" },
  { key: "recordDate", label: "Date" },
  // Required: this is the meeting's actual scheduled date — without it there's no queue item.
  {
    key: "meetingScheduled",
    label: "Meeting Scheduled",
    required: true,
    type: "date",
  },
  {
    key: "companyName",
    label: "Name of the Company",
    required: true,
    aliases: ["Company Name", "Company"],
  },
  { key: "domain", label: "Domain" },
  { key: "hq", label: "HQ" },
  { key: "prospectName", label: "Prospect Name" },
  { key: "title", label: "Title" },
  { key: "contactNumber", label: "Contact Number" },
  {
    key: "email",
    label: "Email id",
    type: "email",
    aliases: ["Email ID", "Email"],
  },
  { key: "areaOfInterest", label: "Area of Interest / Requirement" },
  { key: "comments", label: "Comments" },
];

// --- Duplicate detection --------------------------------------------------------------------------

function accountDuplicateConfig(accounts: CrmAccount[]): DuplicateConfig {
  return {
    keys: ["companyName"],
    findExisting: (mapped) => {
      const match = findPossibleDuplicateAccount(accounts, {
        name: String(mapped.companyName || ""),
        website: String(mapped.domain || ""),
        email: String(mapped.email || ""),
      });
      return match ? { id: match.id, label: match.name } : undefined;
    },
  };
}

// --- Commit: Call Back / Not Interested / Keep in Touch -> CrmAccount.statusTag -------------------

async function commitAccountStatusRows(
  rows: MappedImportRow[],
  strategy: DuplicateStrategy,
  statusTag: "Call Back" | "Not Interested" | "Keep in Touch",
  accounts: CrmAccount[],
  fields: FieldSchema[],
  currentUser: string,
): Promise<ImportSummary> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const statusOptions = {
        reason: (row.data.statusReason as string) || undefined,
        date: (row.data.statusDate as string) || undefined,
      };
      const responseNotes = (row.data.responseNotes as string) || "";
      const { customLeaf, customNested } = splitCustomFields(fields, row.data);

      let accountId: string;
      let accountName: string;
      if (row.isDuplicate && row.duplicateId) {
        if (strategy === "skip") {
          skipped += 1;
          continue;
        }
        if (strategy === "update") {
          const account = accounts.find((a) => a.id === row.duplicateId);
          if (!account) {
            failed += 1;
            errors.push(
              `Row ${row.rowNumber}: matched account no longer exists`,
            );
            continue;
          }
          await changeCrmAccountStatusTag(
            { id: account.id, name: account.name },
            statusTag,
            statusOptions,
            currentUser,
            [],
          );
          if (Object.keys(customLeaf).length > 0) {
            await updateInCollection(CRM_ACCOUNTS_PATH, account.id, customLeaf);
          }
          accountId = account.id;
          accountName = account.name;
          updated += 1;
        } else {
          // strategy === 'create' — create a new Account anyway, same as below.
          accountName = String(row.data.companyName || "");
          accountId = await createCrmAccount({
            name: accountName,
            website: (row.data.domain as string) || undefined,
            email: (row.data.email as string) || undefined,
            createdBy: currentUser,
            ...(Object.keys(customNested).length
              ? { customFields: customNested }
              : {}),
          });
          await changeCrmAccountStatusTag(
            { id: accountId, name: accountName },
            statusTag,
            statusOptions,
            currentUser,
            [],
          );
          created += 1;
        }
      } else {
        accountName = String(row.data.companyName || "");
        accountId = await createCrmAccount({
          name: accountName,
          website: (row.data.domain as string) || undefined,
          email: (row.data.email as string) || undefined,
          createdBy: currentUser,
          ...(Object.keys(customNested).length
            ? { customFields: customNested }
            : {}),
        });
        await changeCrmAccountStatusTag(
          { id: accountId, name: accountName },
          statusTag,
          statusOptions,
          currentUser,
          [],
        );
        created += 1;
      }

      // `changeCrmAccountStatusTag` only folds `reason`/`date` into its own audit/activity detail —
      // preserve the sheet's free-text Response/Comments too (when it wasn't already used as the
      // required `reason` for Not Interested) rather than silently dropping it.
      if (responseNotes && statusTag !== "Not Interested") {
        await logCrmActivitySilently({
          relatedType: "account",
          relatedId: accountId,
          type: "Note",
          subject: "Imported note",
          notes: responseNotes,
          occurredAt: Date.now(),
          createdBy: currentUser,
        });
      }
    } catch (err) {
      failed += 1;
      errors.push(
        `Row ${row.rowNumber}: ${err instanceof Error ? err.message : "Import failed"}`,
      );
    }
  }

  return { totalRows: rows.length, created, updated, skipped, failed, errors };
}

// --- Commit: Yet to Happen -> CrmMeeting (open, linked to a found/created Account+Contact) --------

const MEETING_ACTIVE_STATUSES = MEETING_STATUSES.filter(
  (s) => s !== "COMPLETED" && s !== "CANCELLED",
);

function resolveMeetingStatus(raw: string | undefined): CrmMeetingStatus {
  const match = MEETING_ACTIVE_STATUSES.find(
    (s) => s.toLowerCase() === (raw || "").trim().toLowerCase(),
  );
  return match || "REQUESTED";
}

async function commitYetToHappenRows(
  rows: MappedImportRow[],
  accounts: CrmAccount[],
  fields: FieldSchema[],
  currentUser: string,
): Promise<ImportSummary> {
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const companyName = String(row.data.companyName || "");
      const existing = findPossibleDuplicateAccount(accounts, {
        name: companyName,
        website: row.data.domain as string,
        email: row.data.email as string,
      });
      const accountId = existing
        ? existing.id
        : await createCrmAccount({
            name: companyName,
            website: (row.data.domain as string) || undefined,
            hq: (row.data.hq as string) || undefined,
            email: (row.data.email as string) || undefined,
            createdBy: currentUser,
          });

      if (!existing && row.data.prospectName) {
        await createCrmContact({
          accountId,
          name: String(row.data.prospectName),
          designation: (row.data.title as string) || undefined,
          email: (row.data.email as string) || undefined,
          phone: (row.data.contactNumber as string) || undefined,
          isPrimary: true,
          isDecisionMaker: false,
          createdBy: currentUser,
        });
      }

      // Meetings are always created fresh here (never updated) — a brand-new record, so nesting
      // customFields as a plain object is safe (nothing to clobber).
      const { customNested } = splitCustomFields(fields, row.data);
      await createCrmMeeting(
        {
          relatedType: "account",
          relatedId: accountId,
          mode: "Onsite",
          date: String(row.data.meetingScheduled || row.data.recordDate || ""),
          participants: (row.data.prospectName as string) || undefined,
          agenda:
            (row.data.areaOfInterest as string) ||
            (row.data.comments as string) ||
            undefined,
          status: resolveMeetingStatus(row.data.meetingStatusRaw as string),
          ...(Object.keys(customNested).length
            ? { customFields: customNested }
            : {}),
        },
        currentUser,
      );
      created += 1;
    } catch (err) {
      failed += 1;
      errors.push(
        `Row ${row.rowNumber}: ${err instanceof Error ? err.message : "Import failed"}`,
      );
    }
  }

  return {
    totalRows: rows.length,
    created,
    updated: 0,
    skipped: 0,
    failed,
    errors,
  };
}

// --- Live legacy-sheet row subscriptions (crm/leads, crm/accountsMiningSheet aren't covered by
// useCrmDomainData — that hook only subscribes to the CRM Core Domain collections) — needed here
// purely for duplicate detection, matching exactly what each tab's own Bulk Import already checks
// against. ------------------------------------------------------------------------------------------
function useLegacyRows<T>(path: string): { id: string; row: T }[] {
  const [rows, setRows] = useState<{ id: string; row: T }[]>([]);
  useEffect(() => {
    const unsub = onValue(ref(database, path), (snap) => {
      const val = (snap.val() || {}) as Record<string, T>;
      setRows(Object.entries(val).map(([id, row]) => ({ id, row })));
    });
    return () => unsub();
  }, [path]);
  return rows;
}

export interface CrmBulkImportSheetConfig {
  title: string;
  fields: FieldSchema[];
  duplicate?: DuplicateConfig;
  commitImport: (
    rows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => Promise<ImportSummary>;
  fileBaseName: string;
}

/** Live registry of every importable sheet's field schema, duplicate detection and commit logic.
 *  Call once per CrmBulkImport session — each sheet's config stays live as the underlying CRM data
 *  changes (e.g. a duplicate match against an account created by an earlier sheet in this same
 *  workbook import, or a custom field another sheet just discovered). */
export function useCrmBulkImportRegistry(
  currentUser: string,
): Partial<Record<CrmBulkImportSheetKind, CrmBulkImportSheetConfig>> {
  const { accounts } = useCrmDomainData();
  const leadRows = useLegacyRows<LeadsRow>(LEADS_PATH);
  const miningRows = useLegacyRows<AccountsMiningRow>(ACCOUNTS_MINING_PATH);

  // Accounts Mining and Leads each own their module; Call Back-Send Info / Not Interested / Keep in
  // Touch share the single 'accounts' module (they're all CrmAccount records — see crmBulkImportTypes.ts);
  // Yet to Happen's meetings get their own module.
  const leadCustomDefs = useCrmCustomFields("leads");
  const miningCustomDefs = useCrmCustomFields("accountsMining");
  const accountCustomDefs = useCrmCustomFields("accounts");
  const meetingCustomDefs = useCrmCustomFields("meetings");
  const coldCallingCustomDefs = useCrmCustomFields("coldCalling");

  const leadFields = useMemo(
    () => [
      ...(LEAD_IMPORT_EXPORT_FIELDS as unknown as FieldSchema[]),
      ...customDefsToFields(leadCustomDefs),
    ],
    [leadCustomDefs],
  );
  const miningFields = useMemo(
    () => [
      ...(ACCOUNTS_MINING_FIELDS as unknown as FieldSchema[]),
      ...customDefsToFields(miningCustomDefs),
    ],
    [miningCustomDefs],
  );
  const callBackFields = useMemo(
    () => [
      ...CALL_BACK_SEND_INFO_FIELDS,
      ...customDefsToFields(accountCustomDefs),
    ],
    [accountCustomDefs],
  );
  const notInterestedFields = useMemo(
    () => [...NOT_INTERESTED_FIELDS, ...customDefsToFields(accountCustomDefs)],
    [accountCustomDefs],
  );
  const keepInTouchFields = useMemo(
    () => [...KEEP_IN_TOUCH_FIELDS, ...customDefsToFields(accountCustomDefs)],
    [accountCustomDefs],
  );
  const yetToHappenFields = useMemo(
    () => [...YET_TO_HAPPEN_FIELDS, ...customDefsToFields(meetingCustomDefs)],
    [meetingCustomDefs],
  );
  const coldCallingFields = useMemo(
    () => [
      ...(COLD_CALLING_FIELDS as unknown as FieldSchema[]),
      ...customDefsToFields(coldCallingCustomDefs),
    ],
    [coldCallingCustomDefs],
  );
  const coldCallingRows = useLegacyRows<ColdCallingRow>(COLD_CALLING_PATH);

  const commitLeadsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      LEADS_PATH,
      importRows,
      strategy,
      (row) => {
        const { base, customLeaf, customNested } = splitCustomFields(
          leadFields,
          row.data,
        );
        if (row.isDuplicate && strategy === "update") {
          return { ...base, ...customLeaf };
        }
        return {
          ...emptyLeadRow(),
          ...base,
          ...(Object.keys(customNested).length
            ? { customFields: customNested }
            : {}),
          createdAt: Date.now(),
          createdBy: currentUser,
        };
      },
    );
    await logBulkImportAudit("lead", "Leads", summary, currentUser);
    return summary;
  };

  const commitMiningImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      ACCOUNTS_MINING_PATH,
      importRows,
      strategy,
      (row) => {
        const { base, customLeaf, customNested } = splitCustomFields(
          miningFields,
          row.data,
        );
        if (row.isDuplicate && strategy === "update") {
          return { ...emptyAccountsMiningRow(), ...base, ...customLeaf };
        }
        return {
          ...emptyAccountsMiningRow(),
          ...base,
          ...(Object.keys(customNested).length
            ? { customFields: customNested }
            : {}),
        };
      },
    );
    await logBulkImportAudit(
      "accountsMiningSheet",
      "Accounts Mining Sheet",
      summary,
      currentUser,
    );
    return summary;
  };

  const commitCallBack = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitAccountStatusRows(
      importRows,
      strategy,
      "Call Back",
      accounts,
      callBackFields,
      currentUser,
    );
    await logBulkImportAudit(
      "account",
      "Call Back-Send Info",
      summary,
      currentUser,
    );
    return summary;
  };
  const commitNotInterested = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitAccountStatusRows(
      importRows,
      strategy,
      "Not Interested",
      accounts,
      notInterestedFields,
      currentUser,
    );
    await logBulkImportAudit("account", "Not Interested", summary, currentUser);
    return summary;
  };
  const commitKeepInTouch = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitAccountStatusRows(
      importRows,
      strategy,
      "Keep in Touch",
      accounts,
      keepInTouchFields,
      currentUser,
    );
    await logBulkImportAudit("account", "Keep in Touch", summary, currentUser);
    return summary;
  };
  const commitYetToHappen = async (importRows: MappedImportRow[]) => {
    const summary = await commitYetToHappenRows(
      importRows,
      accounts,
      yetToHappenFields,
      currentUser,
    );
    await logBulkImportAudit("meeting", "Yet to Happen", summary, currentUser);
    return summary;
  };

  // Cold Calling Status rows are logged as-is into their own collection — never auto-routed into
  // Not Interested/Call Back/Keep in Touch on import, since the source status text is free-form
  // and ambiguous (e.g. "Called him in a meeting told to drop an email."); a person routes each
  // row explicitly from the Cold Calling Status tab via StatusTagDialog once reviewed.
  const commitColdCallingImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      COLD_CALLING_PATH,
      importRows,
      strategy,
      (row) => {
        const { base, customLeaf, customNested } = splitCustomFields(
          coldCallingFields,
          row.data,
        );
        if (row.isDuplicate && strategy === "update") {
          return { ...base, ...customLeaf };
        }
        return {
          ...emptyColdCallingRow(),
          ...base,
          ...(Object.keys(customNested).length
            ? { customFields: customNested }
            : {}),
          createdAt: Date.now(),
          createdBy: currentUser,
        };
      },
    );
    await logBulkImportAudit(
      "coldCallingStatus",
      "Cold Calling Status",
      summary,
      currentUser,
    );
    return summary;
  };

  return {
    leads: {
      title: "Leads",
      fields: leadFields,
      fileBaseName: "crm-leads",
      duplicate: {
        keys: ["companyName", "email"],
        findExisting: (mapped) => {
          const company = String(mapped.companyName || "")
            .trim()
            .toLowerCase();
          const email = String(mapped.email || "")
            .trim()
            .toLowerCase();
          if (!company || !email) return undefined;
          const match = leadRows.find(
            ({ row }) =>
              row.companyName?.trim().toLowerCase() === company &&
              row.email?.trim().toLowerCase() === email,
          );
          return match
            ? { id: match.id, label: match.row.companyName || match.id }
            : undefined;
        },
      },
      commitImport: commitLeadsImport,
    },
    accountsMining: {
      title: "Accounts Mining Sheet",
      fields: miningFields,
      fileBaseName: "crm-accounts-mining-sheet",
      duplicate: {
        keys: ["companyName", "email"],
        findExisting: (mapped) => {
          const company = String(mapped.companyName || "")
            .trim()
            .toLowerCase();
          const email = String(mapped.email || "")
            .trim()
            .toLowerCase();
          if (!company || !email) return undefined;
          const match = miningRows.find(
            ({ row }) =>
              row.companyName?.trim().toLowerCase() === company &&
              row.email?.trim().toLowerCase() === email,
          );
          return match
            ? { id: match.id, label: match.row.companyName || match.id }
            : undefined;
        },
      },
      commitImport: commitMiningImport,
    },
    callBackSendInfo: {
      title: "Call Back-Send Info",
      fields: callBackFields,
      fileBaseName: "crm-call-back-send-info",
      duplicate: accountDuplicateConfig(accounts),
      commitImport: commitCallBack,
    },
    notInterested: {
      title: "Not Interested",
      fields: notInterestedFields,
      fileBaseName: "crm-not-interested",
      duplicate: accountDuplicateConfig(accounts),
      commitImport: commitNotInterested,
    },
    keepInTouch: {
      title: "Keep in Touch",
      fields: keepInTouchFields,
      fileBaseName: "crm-keep-in-touch",
      duplicate: accountDuplicateConfig(accounts),
      commitImport: commitKeepInTouch,
    },
    yetToHappen: {
      title: "Yet to Happen",
      fields: yetToHappenFields,
      fileBaseName: "crm-yet-to-happen",
      commitImport: commitYetToHappen,
    },
    coldCalling: {
      title: "Cold Calling Status",
      fields: coldCallingFields,
      fileBaseName: "crm-cold-calling-status",
      duplicate: {
        keys: ["companyName", "prospectName", "date"],
        findExisting: (mapped) => {
          const company = String(mapped.companyName || "")
            .trim()
            .toLowerCase();
          const prospect = String(mapped.prospectName || "")
            .trim()
            .toLowerCase();
          const date = String(mapped.date || "").trim();
          if (!company) return undefined;
          const match = coldCallingRows.find(
            ({ row }) =>
              row.companyName?.trim().toLowerCase() === company &&
              (row.prospectName || "").trim().toLowerCase() === prospect &&
              (row.date || "").trim() === date,
          );
          return match
            ? { id: match.id, label: match.row.companyName || match.id }
            : undefined;
        },
      },
      commitImport: commitColdCallingImport,
    },
  };
}

/** Every module's current field list (built-in + already-discovered custom), keyed the same way as
 *  `CrmCustomFieldModule` — used by `CrmBulkImport.tsx` to know which headers in a sheet are still
 *  genuinely unmatched (and therefore need a new custom field auto-created) right before opening
 *  that sheet's review dialog. */
export function moduleForSheetKind(
  kind: CrmBulkImportSheetKind,
):
  | "leads"
  | "accountsMining"
  | "accounts"
  | "meetings"
  | "coldCalling"
  | undefined {
  switch (kind) {
    case "leads":
      return "leads";
    case "accountsMining":
      return "accountsMining";
    case "callBackSendInfo":
    case "notInterested":
    case "keepInTouch":
      return "accounts";
    case "yetToHappen":
      return "meetings";
    case "coldCalling":
      return "coldCalling";
    default:
      return undefined;
  }
}
