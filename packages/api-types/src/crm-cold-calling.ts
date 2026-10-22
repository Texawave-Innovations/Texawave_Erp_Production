// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/cold-calling/dto/cold-calling.dto.ts and
// apps/api/src/modules/crm/cold-calling/cold-calling.controller.ts. See
// packages/api-types/README.md.

/** Phase 1B — Cold Calling Status queue. Mirrors legacy `ColdCallingRow`
 * (TexaWave_ERP/src/modules/crm/ColdCallingStatus.tsx): raw cold-calling
 * call outcomes logged exactly as they come out of the source spreadsheet,
 * isolated from the Account.statusTag queues until a person explicitly
 * links the row to an Account and routes a disposition. */
export interface CrmColdCallingEntry {
  id: number;
  organizationId: number;
  serialNo: string | null;
  callDate: string | null;
  companyName: string;
  prospectName: string | null;
  designation: string | null;
  status: string | null;
  linkedAccountId: number | null;
  dispositionTag: string | null;
  dispositionAt: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCrmColdCallingEntryInput {
  serialNo?: string | undefined;
  callDate?: string | undefined;
  companyName: string;
  prospectName?: string | undefined;
  designation?: string | undefined;
  status?: string | undefined;
}

export type UpdateCrmColdCallingEntryInput =
  Partial<CreateCrmColdCallingEntryInput>;

export interface LinkCrmColdCallingEntryInput {
  accountId: number;
}

export interface RecordCrmColdCallingDispositionInput {
  dispositionTag: string;
}

export interface QueryCrmColdCallingEntriesInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  search?: string | undefined;
  linkedAccountId?: number | undefined;
  status?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}
