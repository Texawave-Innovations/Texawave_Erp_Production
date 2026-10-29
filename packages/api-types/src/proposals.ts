// HANDWRITTEN — mirrors apps/api/src/modules/projects/proposals/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

export type ProposalTemplateStatus = "draft" | "active" | "archived";

export type ProposalStatus =
  | "draft"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected"
  | "archived";

/** Legacy `proposalTypes.ts` `SectionContentType` — `image` is intentionally
 * omitted (legacy itself never wired up real file storage for it). */
export type ProposalSectionContentType =
  | "short_text"
  | "long_text"
  | "bullet_list"
  | "numbered_list"
  | "key_value"
  | "table"
  | "checklist"
  | "signature"
  | "section_group"
  | "page_break"
  | "spacer";

export interface TableColumnDef {
  id: string;
  name: string;
  type: "text" | "number" | "currency" | "date";
}

export interface KeyValueFieldDef {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "email" | "phone" | "currency";
}

export interface SignatureFieldDef {
  id: string;
  label: string;
  type: "name" | "role" | "signature" | "date" | "seal" | "text";
}

/** Legacy `ProposalSectionConfig` — the dynamic, JSON-driven section schema
 * a `ProposalTemplate.schemaJson` is an array of. `children` nests one level
 * for `section_group` (legacy supports arbitrary depth; one level covers the
 * real templates observed and keeps the builder UI tractable). */
export interface ProposalSectionConfig {
  id: string;
  title: string;
  type: ProposalSectionContentType;
  description?: string | undefined;
  required?: boolean | undefined;
  order: number;
  children?: ProposalSectionConfig[] | undefined;
  defaultItems?: string[] | undefined;
  keyValueFields?: KeyValueFieldDef[] | undefined;
  tableColumns?: TableColumnDef[] | undefined;
  signatureFields?: SignatureFieldDef[] | undefined;
}

export interface ProposalTemplate {
  id: number;
  organizationId: number;
  code: string | null;
  name: string;
  title: string;
  description: string | null;
  department: string | null;
  category: string | null;
  version: number;
  parentVersionId: number | null;
  isCurrent: boolean;
  status: ProposalTemplateStatus;
  isDefault: boolean;
  schemaJson: ProposalSectionConfig[];
  createdBy: number | null;
  createdByName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProposalTemplateInput {
  name: string;
  title: string;
  code?: string | undefined;
  description?: string | undefined;
  department?: string | undefined;
  category?: string | undefined;
  schemaJson?: ProposalSectionConfig[] | undefined;
  isDefault?: boolean | undefined;
}

export interface UpdateProposalTemplateInput {
  name?: string | undefined;
  code?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  department?: string | undefined;
  category?: string | undefined;
  status?: ProposalTemplateStatus | undefined;
  schemaJson?: ProposalSectionConfig[] | undefined;
  isDefault?: boolean | undefined;
}

export interface ProposalActivity {
  id: number;
  organizationId: number;
  proposalId: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  comments: string | null;
  createdAt: string;
}

export interface ProposalDocument {
  id: number;
  organizationId: number;
  proposalNumber: string;
  title: string;
  projectId: number | null;
  projectCode: string | null;
  projectName: string | null;
  clientId: number | null;
  clientName: string | null;
  templateId: number | null;
  templateTitle: string | null;
  templateCode: string | null;
  templateVersion: number | null;
  templateSnapshot: unknown;
  sectionValues: Record<string, unknown>;
  status: ProposalStatus;
  preparedBy: number | null;
  proposalDate: string | null;
  dueDate: string | null;
  followUpNotes: string | null;
  followUpExtensionCount: number;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  activities?: ProposalActivity[];
  /** List endpoint only — author of the `created` activity. */
  createdByName?: string | null;
}

export interface CreateProposalDocumentInput {
  title: string;
  projectId?: number | undefined;
  projectName?: string | undefined;
  clientId?: number | undefined;
  clientName?: string | undefined;
  templateId?: number | undefined;
  sectionValues?: Record<string, unknown> | undefined;
  proposalDate?: string | undefined;
  dueDate?: string | undefined;
}

export interface UpdateProposalDocumentInput {
  title?: string | undefined;
  projectId?: number | undefined;
  projectName?: string | undefined;
  clientId?: number | undefined;
  clientName?: string | undefined;
  templateId?: number | undefined;
  sectionValues?: Record<string, unknown> | undefined;
  proposalDate?: string | undefined;
  dueDate?: string | undefined;
  followUpNotes?: string | undefined;
}

export type ProposalWorkflowAction =
  | "submit_for_review"
  | "review_approve"
  | "request_changes"
  | "send_to_client"
  | "record_accepted"
  | "record_rejected"
  | "revert_to_draft"
  | "archive";

export interface TransitionProposalInput {
  action: ProposalWorkflowAction;
  comments?: string | undefined;
}

export interface ExtendFollowupInput {
  dueDate: string;
  reason?: string | undefined;
}

export interface QueryProposalDocumentsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
  search?: string | undefined;
  status?: string | undefined;
  projectId?: number | undefined;
  clientName?: string | undefined;
  templateId?: number | undefined;
  /** Follow-up due today or overdue on a still-open proposal. */
  followUpDue?: boolean | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  sortBy?: ProposalSortField | undefined;
}

export type ProposalSortField =
  "createdAt" | "proposalNumber" | "title" | "dueDate" | "updatedAt";

/** `GET /proposals/stats` */
export interface ProposalStats {
  total: number;
  byStatus: Partial<Record<ProposalStatus, number>>;
  followUpsDue: number;
  clients: string[];
}

export interface ProposalSettings {
  id: number;
  organizationId: number;
  companyName: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  showHeader: boolean;
  showFooter: boolean;
  showHeaderLogo: boolean;
  showHeaderCompanyName: boolean;
  showHeaderDocTitle: boolean;
  showFooterEmail: boolean;
  showFooterPhone: boolean;
  showFooterWebsite: boolean;
  showFooterAddress: boolean;
  showFooterPageNumber: boolean;
  prefix: string;
  yearFormat: "YYYY" | "YY" | "NONE";
  sequenceDigits: number;
  updatedAt: string;
}

export interface UpdateProposalSettingsInput {
  companyName?: string | undefined;
  logoUrl?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  address?: string | undefined;
  showHeader?: boolean | undefined;
  showFooter?: boolean | undefined;
  showHeaderLogo?: boolean | undefined;
  showHeaderCompanyName?: boolean | undefined;
  showHeaderDocTitle?: boolean | undefined;
  showFooterEmail?: boolean | undefined;
  showFooterPhone?: boolean | undefined;
  showFooterWebsite?: boolean | undefined;
  showFooterAddress?: boolean | undefined;
  showFooterPageNumber?: boolean | undefined;
  prefix?: string | undefined;
  yearFormat?: "YYYY" | "YY" | "NONE" | undefined;
  sequenceDigits?: number | undefined;
}
