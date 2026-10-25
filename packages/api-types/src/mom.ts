// HANDWRITTEN — mirrors apps/api/src/modules/projects/mom/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

export type MomTemplateStatus = "draft" | "active" | "archived";
export type MomStatus = "draft" | "finalized" | "archived";

/** Legacy `types/mom.ts` `MomSectionType`/`MomSectionConfig` — unlike
 * Proposals, MoM sections are a FIXED set of content blocks; the template
 * only controls their visibility, order, and required flag. */
export type MomSectionType =
  | "company_header"
  | "meeting_details"
  | "people_lists"
  | "agenda_list"
  | "free_text"
  | "meeting_notes_table";

export interface MomSectionConfig {
  id: string;
  type: MomSectionType;
  title: string;
  order: number;
  visible: boolean;
  required: boolean;
  description?: string | undefined;
  /** Pre-filled text for a `free_text` section. */
  defaultContent?: string | undefined;
}

export interface MomTemplate {
  id: number;
  organizationId: number;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  version: number;
  parentVersionId: number | null;
  status: MomTemplateStatus;
  isDefault: boolean;
  sectionsJson: MomSectionConfig[];
  defaultAgendaJson: unknown[];
  defaultNoteRowsJson: unknown[];
  createdBy: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMomTemplateInput {
  name: string;
  code?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  sectionsJson?: MomSectionConfig[] | undefined;
  defaultAgendaJson?: unknown[] | undefined;
  defaultNoteRowsJson?: unknown[] | undefined;
  isDefault?: boolean | undefined;
}

export interface UpdateMomTemplateInput {
  name?: string | undefined;
  code?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  status?: MomTemplateStatus | undefined;
  sectionsJson?: MomSectionConfig[] | undefined;
  defaultAgendaJson?: unknown[] | undefined;
  defaultNoteRowsJson?: unknown[] | undefined;
  isDefault?: boolean | undefined;
}

/** Legacy `AttendanceType`. Rows saved before this field existed have no
 * `attendance` and are treated as present. */
export type MomAttendance = "present" | "remote" | "absent";

export interface MomAttendee {
  id: string;
  name: string;
  role?: string | undefined;
  organization?: string | undefined;
  attendance?: MomAttendance | undefined;
}

export interface MomAgendaItem {
  id: string;
  order: number;
  topic: string;
  presenter?: string | undefined;
  durationMinutes?: number | undefined;
}

export interface MomNoteRow {
  id: string;
  order: number;
  agendaItem?: string | undefined;
  discussionPoints?: string | undefined;
  actionItems?: string | undefined;
}

export interface MomRevision {
  id: number;
  organizationId: number;
  momId: number;
  revisionNumber: number;
  userId: number | null;
  userName: string | null;
  changeSummary: string | null;
  snapshotJson: unknown;
  createdAt: string;
}

export interface MomHistoryEvent {
  id: number;
  organizationId: number;
  momId: number;
  userId: number | null;
  userName: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface MomDocument {
  id: number;
  organizationId: number;
  reference: string;
  projectId: number | null;
  projectCode: string | null;
  projectName: string | null;
  clientName: string | null;
  meetingTitle: string;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  location: string | null;
  attendeesJson: MomAttendee[];
  absenteesJson: MomAttendee[];
  agendaJson: MomAgendaItem[];
  meetingNotesJson: MomNoteRow[];
  additionalSectionsJson: unknown[];
  freeTextContent: string | null;
  status: MomStatus;
  previousStatus: string | null;
  templateId: number | null;
  templateTitle: string | null;
  templateVersion: number | null;
  templateSnapshot: unknown;
  currentRevision: number;
  workingRevision: number | null;
  workingRevisionReason: string | null;
  versionToken: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revisions?: MomRevision[];
  history?: MomHistoryEvent[];
}

export interface CreateMomDocumentInput {
  meetingTitle: string;
  meetingDate: string;
  startTime?: string | undefined;
  endTime?: string | undefined;
  timezone?: string | undefined;
  location?: string | undefined;
  projectId?: number | undefined;
  projectName?: string | undefined;
  clientName?: string | undefined;
  templateId?: number | undefined;
  attendeesJson?: MomAttendee[] | undefined;
  absenteesJson?: MomAttendee[] | undefined;
  agendaJson?: MomAgendaItem[] | undefined;
  meetingNotesJson?: MomNoteRow[] | undefined;
  additionalSectionsJson?: unknown[] | undefined;
  freeTextContent?: string | undefined;
}

export interface UpdateMomDocumentInput extends CreateMomDocumentInput {
  versionToken?: string | undefined;
}

export interface StartMomRevisionInput {
  /** Required (3–500 chars) — recorded in the permanent audit trail. */
  reason: string;
}

/** Legacy `MomAdditionalSection` — stored in `additionalSectionsJson`; the
 * editor keeps one `rich_text` entry per extra `free_text` template section
 * (the first `free_text` section uses `freeTextContent`). */
export interface MomAdditionalSection {
  id: string;
  title: string;
  contentType: "rich_text" | "bullet_list" | "key_value" | "table";
  order: number;
  content: unknown;
}

/** `GET /mom/stats` */
export interface MomStats {
  total: number;
  draft: number;
  finalized: number;
  archived: number;
  inRevision: number;
}

export type MomSortField =
  "meetingDate" | "reference" | "meetingTitle" | "updatedAt";

export interface QueryMomDocumentsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
  search?: string | undefined;
  status?: string | undefined;
  projectId?: number | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  sortBy?: MomSortField | undefined;
}
