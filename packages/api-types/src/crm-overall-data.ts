// HANDWRITTEN — mirrors apps/api/src/modules/crm/overall-data/
// (overall-data.controller.ts, overall-data.derive.ts). See
// packages/api-types/README.md.

export type CrmOverallRowKey =
  | "accountsMined"
  | "emailsSent"
  | "meetingsScheduled"
  | "meetingsCompleted"
  | "meetingsCancelled"
  | "sendInfoCallBacks"
  | "followUp"
  | "notInterested"
  | "callsMade";

export type CrmOverallRecordType =
  "mining_row" | "cold_calling_entry" | "activity" | "meeting" | "audit";

export interface CrmOverallDataMonth {
  year: number;
  month: number;
  rows: { key: CrmOverallRowKey; label: string }[];
  /** yyyy-MM-dd for every day of the month. */
  days: string[];
  daily: Record<CrmOverallRowKey, Record<string, number>>;
  monthTotals: Record<CrmOverallRowKey, number>;
}

export interface CrmOverallActivityRecord {
  id: string;
  recordType: CrmOverallRecordType;
  recordId: number;
  at: string;
  time: string;
  owner: string;
  accountId?: number;
  accountName?: string;
  contactId?: number;
  contactName?: string;
  action: string;
  status?: string;
  source?: string;
  notes?: string;
  dueDate?: string;
  completedDate?: string;
  viewPath?: string;
}

export interface QueryCrmOverallDataInput {
  year: number;
  month: number;
}

export interface QueryCrmOverallDataRecordsInput extends QueryCrmOverallDataInput {
  row: CrmOverallRowKey;
  day: string;
}
