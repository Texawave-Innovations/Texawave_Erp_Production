// CRM Module — shared types
// Scope: Overall Data tab only (7 more tabs to be added later, one at a time).

/** Row keys for the daily disposition tracking table, in required display order. */
export type TrackingRowKey =
  | "accountsMined"
  | "emailsSent"
  | "meetingsScheduled"
  | "meetingsCompleted"
  | "meetingsCancelled"
  | "sendInfoCallBacks"
  | "followUp"
  | "notInterested"
  | "callsMade";

export interface TrackingRowDef {
  key: TrackingRowKey;
  label: string;
}

/** Daily values for one disposition row, keyed by ISO date (yyyy-MM-dd). */
export type DailyValues = Record<string, number>;

/** Full month's data: one DailyValues map per tracking row. */
export type OverallDataMonth = Partial<Record<TrackingRowKey, DailyValues>>;

/** Manually entered Weekly/Monthly Report values for one month, keyed by summary row key. */
export type OverallReportMonth = Partial<Record<TrackingRowKey, number>>;

/**
 * One real, underlying CRM record behind a single Overall Data cell — the actual account mining
 * row / activity / meeting / audit-log entry a disposition count was derived from. Every field is
 * optional except the identifying/traceability ones, since which fields apply depends on the
 * disposition (e.g. `dealStage` only ever appears for opportunity-linked activities). Never
 * fabricated — always built directly from the same live CRM Core Domain data the daily counts are
 * computed from, so a cell's count is always exactly `records.length` for that cell.
 */
export interface OverallActivityRecord {
  /** Unique within its (row, day) bucket — prefixed by source so ids never collide across sources. */
  id: string;
  /** Epoch ms the record is bucketed/sorted by. */
  atMs: number;
  /** Pre-formatted local (Asia/Kolkata) time, e.g. "09:42 AM". */
  time: string;
  owner: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  /** What happened — e.g. "Accounts Mined", "Discovery call", "Not Interested". */
  action: string;
  status?: string;
  dueDate?: string;
  completedDate?: string;
  dealStage?: string;
  source?: string;
  notes?: string;
  /** The original Firebase record id this was derived from, for traceability. */
  recordId: string;
  /** In-app route to open the underlying Account/Contact/Deal, when resolvable. */
  viewPath?: string;
}

// --- Accounts Mining Sheet (CRM tab 2) — isolated from Overall Data above. ---

/** One row of the Accounts Mining Sheet. All fields are free-form text. */
export interface AccountsMiningRow {
  serialNo: string;
  date: string;
  domain: string;
  companyName: string;
  hq: string;
  website: string;
  keyDecisionMakers: string;
  title: string;
  contactNumber: string;
  email: string;
  emailStatus: string;
  followUpStatus: string;
  // --- Additional related details (kept optional so existing rows remain valid) ---
  industry?: string;
  numberOfEmployees?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedInProfile?: string;
  assignedTo?: string;
  priority?: string;
  nextFollowUpDate?: string;
  notes?: string;
  createdAt?: number;
  createdBy?: string;
  /** Set once this row has been promoted to a Lead — links to `crm/leads`, and hides/disables the
   *  Promote action so the same mining row can't be promoted twice. */
  promotedToLeadRowId?: string;
  /** Fields discovered from an imported Excel column with no matching built-in field above — see
   *  `bulkImport/crmCustomFieldsService.ts`. Keyed by the field's generated key (never a built-in
   *  field name), rendered/edited generically wherever this row's other fields are. */
  customFields?: Record<string, string>;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type AccountsMiningSheetData = Record<string, AccountsMiningRow>;

// --- Leads (CRM tab 3) — isolated from Overall Data and Accounts Mining Sheet above. ---

/** One row of the Leads sheet. All fields are free-form text. */
export interface LeadsRow {
  meetingStatus: string;
  month: string;
  date: string;
  meetingScheduled: string;
  companyName: string;
  domain: string;
  hq: string;
  prospectName: string;
  title: string;
  contactNumber: string;
  email: string;
  areaOfInterest: string;
  comments: string;
  // --- Lead management extension (CRM Core Domain) — appended after the original columns above,
  // which are untouched. See `domain/types.ts` CrmLeadStatus for the status vocabulary. ---
  /** One of CrmLeadStatus; kept as free text here (like every other column in this sheet) so old
   * rows without this field render as blank rather than breaking. */
  leadStatus?: string;
  priority?: string;
  assignedTo?: string;
  leadSource?: string;
  /** Set once this row has been converted — links to the new `crm/accounts` / `crm/opportunities` records. */
  linkedAccountId?: string;
  linkedOpportunityId?: string;
  /** Set once this row has been converted and a Contact was created for it — links to `crm/contacts`. */
  linkedContactId?: string;
  // --- Enterprise Lead enhancement (additive) — appended after the domain extension above.
  // Every field here is optional so existing rows without them render blank instead of breaking,
  // and every existing field/column above is untouched. */
  /** Secondary phone number, distinct from `contactNumber`. */
  mobile?: string;
  fax?: string;
  website?: string;
  skypeId?: string;
  industry?: string;
  annualRevenue?: string;
  numberOfEmployees?: string;
  /** 'Yes' | 'No' — kept as free text like every other field in this sheet. */
  emailOptOut?: string;
  /** GDPR-style legal basis for holding this lead's data (e.g. "Consent", "Contract"). */
  dataProcessingBasis?: string;
  addressStreet?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  /** Comma-separated tag list — kept as free text rather than a new sub-collection. */
  tags?: string;
  createdAt?: number;
  createdBy?: string;
  /** Set when this lead was promoted from an Accounts Mining Sheet row — preserves the original
   *  prospecting source through the full Mining → Lead → Account → Opportunity funnel. */
  sourceMiningRowId?: string;
  /** Fields discovered from an imported Excel column with no matching built-in field above — see
   *  `bulkImport/crmCustomFieldsService.ts`. Keyed by the field's generated key (never a built-in
   *  field name), rendered/edited generically wherever this row's other fields are. */
  customFields?: Record<string, string>;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type LeadsSheetData = Record<string, LeadsRow>;

// --- Yet to Happen (CRM tab 4) — isolated from Overall Data, Accounts Mining Sheet, and Leads above. ---

/** One row of the Yet to Happen sheet. All fields are free-form text. */
export interface YetToHappenRow {
  meetingStatus: string;
  date: string;
  meetingScheduled: string;
  companyName: string;
  domain: string;
  hq: string;
  prospectName: string;
  title: string;
  contactNumber: string;
  email: string;
  areaOfInterest: string;
  comments: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type YetToHappenSheetData = Record<string, YetToHappenRow>;

// --- Call Back-Send Info (CRM tab 5) — isolated from Overall Data, Accounts Mining Sheet, Leads, and Yet to Happen above. ---

/** One row of the Call Back-Send Info sheet. All fields are free-form text. */
export interface CallBackSendInfoRow {
  source: string;
  date: string;
  companyName: string;
  domain: string;
  prospectName: string;
  title: string;
  email: string;
  comments: string;
  nextFollowUp: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type CallBackSendInfoSheetData = Record<string, CallBackSendInfoRow>;

// --- Not Interested (CRM tab 6) — isolated from Overall Data, Accounts Mining Sheet, Leads, Yet to Happen, and Call Back-Send Info above. ---

/** One row of the Not Interested sheet. All fields are free-form text. */
export interface NotInterestedRow {
  source: string;
  date: string;
  companyName: string;
  domain: string;
  prospectName: string;
  title: string;
  email: string;
  comments: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type NotInterestedSheetData = Record<string, NotInterestedRow>;

// --- Keep in Touch (CRM tab 7) — isolated from Overall Data, Accounts Mining Sheet, Leads, Yet to Happen, Call Back-Send Info, and Not Interested above. ---

/** One row of the Keep in Touch sheet. All fields are free-form text. */
export interface KeepInTouchRow {
  source: string;
  date: string;
  companyName: string;
  prospectName: string;
  title: string;
  email: string;
  comments: string;
  nextFollowUp: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type KeepInTouchSheetData = Record<string, KeepInTouchRow>;

// --- WhatsApp (CRM tab 8) — isolated from all other CRM tabs above. ---

/** One row of the WhatsApp outreach sheet. All fields are free-form text. */
export interface WhatsAppRow {
  source: string;
  date: string;
  companyName: string;
  prospectName: string;
  contactNumber: string;
  title: string;
  message: string;
  response: string;
  followUpDate: string;
  status: string;
  comments: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type WhatsAppSheetData = Record<string, WhatsAppRow>;

// --- Cold Calling Status — isolated from all other CRM tabs above. Additive new module: tracks
// raw cold-calling outcomes ("Not Interested, whatsapp msg send.", "Hang up Whatsapp msg send.",
// etc.) exactly as logged, ahead of them being routed into the existing Interested / Not
// Interested / Keep in Touch / Call Back-Send Info disposition queues. Sits between Accounts
// Mining and those queues in the funnel: Accounts Mining -> Cold Calling -> Cold Calling Status ->
// existing disposition. See `domain/types.ts` CrmStatusTag for the disposition vocabulary a row
// can be routed to once a human reviews it. ---

/** One row of the Cold Calling Status sheet. `status` is intentionally free text (never a fixed
 *  enum) so any future call outcome can be logged without a code change — only the explicit
 *  "Route to CRM Status" action (never bulk import) maps a row to one of the existing disposition
 *  tags, and only when a person picks it. */
export interface ColdCallingRow {
  /** Serial number exactly as given in the source Excel ("SINO") — kept as free text since it's
   *  provided data, not a generated id (the Firebase push id already serves that role). */
  serialNo: string;
  date: string;
  companyName: string;
  prospectName: string;
  designation: string;
  /** Original call outcome text, preserved exactly as entered/imported — never overwritten by a
   *  later disposition routing (see `dispositionTag` below). */
  status: string;
  createdAt?: number;
  createdBy?: string;
  /** Set once this row has been linked (matched or newly created) to a Core CRM Account — see
   *  `domain/accountsService.ts` findPossibleDuplicateAccount / createCrmAccount. */
  linkedAccountId?: string;
  linkedAccountName?: string;
  /** Set once a person has explicitly routed this row into one of the existing disposition queues
   *  (Interested / Not Interested / Keep in Touch / Call Back / Send Info) via `StatusTagDialog`.
   *  Purely a record of what happened — the account's own `statusTag` remains the live value. */
  dispositionTag?: string;
  dispositionAt?: number;
  /** Fields discovered from an imported Excel column with no matching built-in field above — see
   *  `bulkImport/crmCustomFieldsService.ts`. Keyed by the field's generated key (never a built-in
   *  field name), rendered/edited generically wherever this row's other fields are. */
  customFields?: Record<string, string>;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type ColdCallingSheetData = Record<string, ColdCallingRow>;

// --- LinkedIn (CRM tab 9) — isolated from all other CRM tabs above, including WhatsApp. ---

/** One row of the LinkedIn outreach sheet. All fields are free-form text. */
export interface LinkedInRow {
  source: string;
  date: string;
  companyName: string;
  domain: string;
  prospectName: string;
  title: string;
  profileUrl: string;
  connectionStatus: string;
  message: string;
  response: string;
  followUpDate: string;
  comments: string;
}

/** Full sheet: rows keyed by Firebase push id (chronologically sortable). */
export type LinkedInSheetData = Record<string, LinkedInRow>;
