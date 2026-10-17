// Types for the CRM multi-sheet Bulk Import workflow (this folder) — the header-level "Bulk
// Import" action that reads one Excel workbook containing several CRM sheets at once and routes
// each sheet to its own module. Built on top of, and reusing, the single-sheet engine in
// `../importExport/` (ParsedWorkbook, FieldSchema, ImportSummary, BulkImportDialog, …) rather than
// duplicating it.
import { ImportSummary } from "../importExport/types";

export type CrmBulkImportSheetKind =
  | "accountsMining"
  | "leads"
  | "yetToHappen"
  | "callBackSendInfo"
  | "notInterested"
  | "keepInTouch"
  | "coldCalling"
  | "overallData"
  | "unrecognized";

export const SHEET_MODULE_LABEL: Record<CrmBulkImportSheetKind, string> = {
  accountsMining: "Accounts Mining",
  leads: "Leads",
  yetToHappen: "Yet to Happen",
  callBackSendInfo: "Call Back-Send Info",
  notInterested: "Not Interested",
  keepInTouch: "Keep in Touch",
  coldCalling: "Cold Calling Status",
  overallData: "Overall Data (summary — not imported directly)",
  unrecognized: "Unrecognized Sheet",
};

/** One detected sheet from the uploaded workbook, plus its live review/import state. */
export interface CrmBulkImportSheetEntry {
  sheetName: string;
  kind: CrmBulkImportSheetKind;
  columnCount: number;
  rowCount: number;
  /** True for the 6 routable sheets — false for Overall Data (informational only, it's a fully
   *  computed/derived view — see `useOverallDataLive.ts`) and Unrecognized sheets. */
  importable: boolean;
  /** Set once the user has opened, mapped, previewed and confirmed (or explicitly closed without
   *  importing) this sheet's review dialog. */
  reviewed: boolean;
  summary?: ImportSummary;
}
