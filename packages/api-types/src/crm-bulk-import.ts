/** Wire types for CRM Bulk Import / Export (apps/api/src/modules/crm/bulk-import). */

export type CrmImportEntity =
  | "leads"
  | "accounts"
  | "contacts"
  | "products"
  | "mining-rows"
  | "cold-calling"
  | "meetings"
  | "call-back-send-info"
  | "not-interested"
  | "keep-in-touch"
  | "opportunities";

export type CrmCustomFieldModule =
  "leads" | "accountsMining" | "accounts" | "meetings" | "coldCalling";

export type CrmImportDuplicateStrategy = "skip" | "update" | "create";

export interface CrmImportFieldSpec {
  key: string;
  label: string;
  aliases?: string[];
  type?: "string" | "number" | "email" | "date" | "select" | "boolean" | "tags";
  options?: string[];
  required?: boolean;
}

export interface CrmCustomFieldDef {
  id: number;
  module: CrmCustomFieldModule;
  key: string;
  label: string;
  sourceHeader: string | null;
  createdAt: string;
}

export interface CrmImportFieldsResponse {
  entity: CrmImportEntity;
  customFieldModule: CrmCustomFieldModule | null;
  fields: CrmImportFieldSpec[];
  customFields: CrmCustomFieldDef[];
}

export interface CrmMatchHeadersResponse {
  entity: CrmImportEntity;
  fields: CrmImportFieldSpec[];
  /** Per input header (same order): matched field key or null. */
  mapping: (string | null)[];
}

export interface CrmImportRowInput {
  rowNumber: number;
  values: Record<string, string>;
  custom?: Record<string, string>;
}

export interface CommitCrmImportInput {
  strategy: CrmImportDuplicateStrategy;
  dryRun?: boolean;
  rows: CrmImportRowInput[];
}

export type CrmImportRowStatus =
  | "created"
  | "updated"
  | "skipped"
  | "failed"
  | "valid"
  | "duplicate"
  | "invalid";

export interface CrmImportRowResult {
  rowNumber: number;
  status: CrmImportRowStatus;
  id?: number;
  duplicateId?: number;
  duplicateLabel?: string;
  errors: string[];
}

export interface CrmImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  valid: number;
  duplicates: number;
}

export interface CommitCrmImportResult {
  entity: CrmImportEntity;
  dryRun: boolean;
  strategy: CrmImportDuplicateStrategy;
  summary: CrmImportSummary;
  rows: CrmImportRowResult[];
  newCustomFields: string[];
  ignoredColumns: string[];
}

export type CrmExportEntity = CrmImportEntity | "quotations";

export interface QueryCrmExportInput {
  search?: string | undefined;
  limit?: number | undefined;
  includeCustomFields?: boolean | undefined;
}

export interface CrmExportResult {
  entity: CrmExportEntity;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  total: number;
  truncated: boolean;
}

/** Server-side hard cap on rows per commit request. */
export const CRM_IMPORT_MAX_ROWS_PER_REQUEST = 200;
