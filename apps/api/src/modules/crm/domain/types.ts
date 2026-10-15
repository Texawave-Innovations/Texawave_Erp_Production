// CRM Core Domain — shared types.
//
// This is a NEW, purely additive relational layer on top of the existing 9 sheet tabs
// (`src/modules/crm/*.tsx`) and the read-only Intelligence Layer (`src/modules/crm/intelligence/*`).
// Nothing here is written by, or overwrites, any of those — it lives entirely under its own
// Firebase Realtime Database paths (see `config.ts` for the path constants), so every existing
// CRM tab, page, and route keeps working exactly as before.
//
// Relationship this domain models:
//   Lead -> Qualify/Convert -> Account -> Contacts -> Opportunity
//        -> Activities/Meetings/Follow-ups/Tasks -> Proposal/Negotiation -> Won/Lost/On Hold

export type CrmRelatedType = "lead" | "account" | "contact" | "opportunity";

// --- Accounts / Clients -----------------------------------------------------------------

export type CrmAccountType =
  "Prospect" | "Customer" | "Partner" | "Vendor" | "Reseller";
export type CrmCustomerCategory =
  "Enterprise" | "Mid-Market" | "SMB" | "Individual";
export type CrmCustomerClass = "A" | "B" | "C";
export type CrmBusinessType =
  | "Manufacturer"
  | "Distributor"
  | "Retailer"
  | "Service Provider"
  | "Reseller"
  | "Other";

/**
 * Unified status/tag taxonomy — replaces the old pattern of re-entering the same company as a
 * separate row in the Not Interested / Keep in Touch / Call Back-Send Info legacy sheets.
 * Independent of pipeline `stage`: a status tag describes engagement posture, not deal progress.
 */
export type CrmStatusTag =
  "Interested" | "Not Interested" | "Keep in Touch" | "Call Back" | "Send Info";

export type CrmAccountHealth = "Healthy" | "Delayed" | "Critical";

export interface CrmAccount {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  hq?: string;
  phone?: string;
  email?: string;
  /** LinkedIn company/profile page URL — free text, opened as-is in a new tab. */
  linkedin?: string;
  ownerName?: string;
  /** The `crm/leads` push id this account was converted from, if any. */
  sourceLeadRowId?: string;
  /** Forward-compatible link for future ERP integration — never written to automatically. */
  linkedSalesCustomerId?: string;
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt?: number;
  // --- Account 360 extension fields (additive) --------------------------------------------
  accountType?: CrmAccountType;
  /** Company registration / GST / tax reference number — free text, format varies by region. */
  registrationNumber?: string;
  numberOfEmployees?: number;
  annualRevenue?: number;
  description?: string;
  tags?: string[];
  // Billing address
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  // Shipping address
  shippingStreet?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  // Customer / business profile
  customerCategory?: CrmCustomerCategory;
  customerClass?: CrmCustomerClass;
  businessType?: CrmBusinessType;
  /** Free-text reseller/customer-type note (e.g. "Channel Partner", "Direct Reseller"). */
  resellerType?: string;
  // --- Unified status/tag system (additive) -------------------------------------------------
  statusTag?: CrmStatusTag;
  /** Required for Not Interested. */
  statusReason?: string;
  /** Required for Keep in Touch (re-engage date) and Call Back (date+time, ISO string). */
  statusDate?: string;
  /** Required for Send Info — what information was requested. */
  statusInfoType?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: number;
  // --- Territory / segmentation (additive) --------------------------------------------------
  territory?: string;
  region?: string;
  segment?: string;
  // --- Account health (additive, computed and cached by domainNotificationService) ---------
  healthScore?: number;
  healthTrend?: "up" | "down" | "flat";
  /** Fields discovered from an imported Excel column with no matching built-in Account field —
   *  see `bulkImport/crmCustomFieldsService.ts`. Keyed by the field's generated key, rendered/
   *  edited generically on the Account form and Account 360 page. */
  customFields?: Record<string, string>;
}

export type CrmAccountInput = Omit<
  CrmAccount,
  "id" | "createdAt" | "updatedAt"
>;

// --- Contacts ----------------------------------------------------------------------------

export interface CrmContact {
  id: string;
  accountId: string;
  name: string;
  designation?: string;
  department?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type CrmContactInput = Omit<
  CrmContact,
  "id" | "createdAt" | "updatedAt"
>;

// --- Opportunities / Sales Pipeline -------------------------------------------------------

export type CrmOpportunityStatus = "OPEN" | "WON" | "LOST" | "ON_HOLD";

export type CrmLostReason =
  | "Pricing"
  | "Competitor Selected"
  | "No Budget"
  | "Requirement Not Supported"
  | "Decision Delayed"
  | "No Response"
  | "Project Cancelled"
  | "Internal Approval Failed"
  | "Timeline Issue"
  | "Product Gap"
  | "Relationship Issue"
  | "Other";

export type CrmHoldReason =
  | "Budget Freeze"
  | "Client Requested Pause"
  | "Internal Priority Change"
  | "Awaiting Approval"
  | "Awaiting Documentation"
  | "Resourcing Constraint"
  | "Other";

export type CrmStuckReason =
  | "Waiting for Client"
  | "Client Unavailable"
  | "Internal Approval Pending"
  | "Pricing Discussion"
  | "Technical Clarification"
  | "No Response"
  | "Competitor Evaluation"
  | "Budget Issue"
  | "Management Discussion"
  | "Other";

export type CrmOpportunityHealth = "Healthy" | "Delayed" | "Critical";

export interface CrmOpportunity {
  id: string;
  accountId: string;
  /** The `crm/leads` push id this opportunity originated from, if any. */
  leadRowId?: string;
  /** Human-readable, searchable identifier — `OPP-<last 6 chars of id, uppercased>`, set at creation. */
  opportunityNumber?: string;
  title: string;
  ownerName: string;
  /** Current pipeline stage id — see `config.ts` PIPELINE_STAGES. */
  stage: string;
  /** When the opportunity entered its current stage — drives stuck-opportunity health. */
  stageEnteredAt: number;
  estimatedValue: number;
  currency?: string;
  expectedCloseDate?: string;
  probability?: number;
  priority?: "High" | "Medium" | "Low";
  nextAction?: string;
  nextActionDate?: string;
  lastActivityAt?: number;
  status: CrmOpportunityStatus;
  lostReason?: CrmLostReason;
  lostReasonOther?: string;
  lostAt?: number;
  /** Set only when lostReason === 'Competitor Selected' — the "Lost to Competition" detail. */
  competitor?: string;
  stuckReason?: CrmStuckReason;
  stuckReasonOther?: string;
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt?: number;
  // --- Deal extension fields (additive) ---------------------------------------------------
  /** Primary contact for this deal — one of the account's `CrmContact`s. */
  contactId?: string;
  /** Free-text role of the primary contact in this deal's buying decision (e.g. "Decision Maker"). */
  contactRole?: string;
  /** Where this deal's pipeline entry originated (e.g. campaign/channel name). */
  campaignSource?: string;
  /** Final agreed amount captured at Won time — falls back to `estimatedValue` when absent. */
  closingAmount?: number;
  /** Final closing date captured at Won time — falls back to `expectedCloseDate` when absent. */
  closingDate?: string;
  /** Timestamp the deal was marked Won. */
  wonAt?: number;
  // --- On Hold extension fields (additive) ------------------------------------------------
  holdReason?: CrmHoldReason;
  holdReasonOther?: string;
  /** Optional target date the deal owner expects to resume active work. */
  expectedResumeDate?: string;
  holdNotes?: string;
  /** Timestamp the deal was put On Hold. */
  onHoldAt?: number;
  /** Timestamp the deal was last resumed from On Hold back to OPEN. */
  resumedAt?: number;
  // --- Lead scoring, forecast, competitor tracking (additive) -------------------------------
  /** 0-100, carried over from the source Lead at conversion (see LeadsRow.leadScore) if set there. */
  leadScore?: number;
  leadTemperature?: "Hot" | "Warm" | "Cold";
  forecastCategory?: "Best Case" | "Commit" | "Pipeline" | "Omitted";
  /** References `crm/competitors` — kept alongside the existing free-text `competitor` field
   *  above for backward compatibility; new deals set both where a competitor is known. */
  competitorId?: string;
}

export type CrmOpportunityInput = Omit<
  CrmOpportunity,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "stageEnteredAt"
  | "status"
  | "createdBy"
  | "opportunityNumber"
> & { status?: CrmOpportunityStatus };

// --- Stage History -------------------------------------------------------------------------

export interface CrmStageHistoryEntry {
  id: string;
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string;
  changedAt: number;
  remarks?: string;
}

// --- Activities (unified activity system) --------------------------------------------------

export type CrmActivityType =
  | "Call"
  | "Email"
  | "WhatsApp"
  | "Meeting"
  | "Demo"
  | "Note"
  | "Task"
  | "Follow-up"
  | "Proposal"
  | "LinkedIn"
  // Auto-logged by opportunitiesService whenever a deal moves stage, is Won/Lost/On-Hold,
  // Reopened, or has products/value/owner changed — surfaces those events on the unified
  // Account/Contact/Opportunity Timeline alongside manually-logged Calls/Emails/etc.
  | "Stage Change";

export type CrmActivityDirection = "Sent" | "Received";

export interface CrmActivity {
  id: string;
  type: CrmActivityType;
  relatedType: CrmRelatedType;
  relatedId: string;
  subject: string;
  notes?: string;
  occurredAt: number;
  createdBy: string;
  createdAt: number;
  /** Sent/Received — set for Email activities only; other channel types leave this unset. */
  direction?: CrmActivityDirection;
}

export type CrmActivityInput = Omit<CrmActivity, "id" | "createdAt">;

// --- Follow-ups ------------------------------------------------------------------------------

export type CrmFollowUpStatus =
  "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED" | "RESCHEDULED" | "MISSED";

export interface CrmRescheduleHistoryEntry {
  previousDate: string;
  reason?: string;
  rescheduledBy: string;
  rescheduledAt: number;
}

export interface CrmFollowUp {
  id: string;
  relatedType: CrmRelatedType;
  relatedId: string;
  type: CrmActivityType;
  scheduledAt: string;
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  notes?: string;
  outcome?: string;
  status: CrmFollowUpStatus;
  nextFollowUpAt?: string;
  /** Append-only reschedule trail — every prior date is kept, never overwritten. */
  rescheduleHistory?: Record<string, CrmRescheduleHistoryEntry>;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type CrmFollowUpInput = Omit<
  CrmFollowUp,
  "id" | "createdAt" | "updatedAt" | "status" | "createdBy"
> & { status?: CrmFollowUpStatus };

// --- Meetings ----------------------------------------------------------------------------------

export type CrmMeetingMode = "Online" | "Onsite" | "Phone" | "Demo";
export type CrmMeetingStatus =
  | "REQUESTED"
  | "TENTATIVE"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "NO_SHOW";

export interface CrmMeeting {
  id: string;
  relatedType: CrmRelatedType;
  relatedId: string;
  mode: CrmMeetingMode;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  participants?: string;
  status: CrmMeetingStatus;
  /** Set once, the moment `status` transitions to COMPLETED — the immutable event timestamp Overall
   *  Data derives "Meeting Completed" counts from, distinct from `createdAt` (scheduling time). */
  completedAt?: number;
  /** Set once, the moment `status` transitions to CANCELLED — mirrors `completedAt` for cancellations. */
  cancelledAt?: number;
  // Post-meeting fields
  summary?: string;
  requirements?: string;
  concerns?: string;
  competitors?: string;
  budget?: string;
  decisionMaker?: string;
  expectedTimeline?: string;
  nextStep?: string;
  nextFollowUpAt?: string;
  /** Append-only reschedule trail — every prior date is kept, never overwritten. */
  rescheduleHistory?: Record<string, CrmRescheduleHistoryEntry>;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  /** Fields discovered from an imported Excel column with no matching built-in Meeting field —
   *  see `bulkImport/crmCustomFieldsService.ts`. Keyed by the field's generated key. Data-safety
   *  only — Meetings have no per-field edit form in the CRM today, so unlike Leads/Accounts Mining/
   *  Accounts these aren't yet surfaced as their own inputs/columns anywhere. */
  customFields?: Record<string, string>;
}

export type CrmMeetingInput = Omit<
  CrmMeeting,
  "id" | "createdAt" | "updatedAt" | "status" | "createdBy"
> & { status?: CrmMeetingStatus };

// --- Tasks ---------------------------------------------------------------------------------------

export interface CrmTask {
  id: string;
  relatedType: CrmRelatedType;
  relatedId: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "Completed";
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type CrmTaskInput = Omit<
  CrmTask,
  "id" | "createdAt" | "updatedAt" | "status" | "createdBy"
> & { status?: CrmTask["status"] };

// --- Quotations (CRM-scoped; isolated from the unrelated `sales/quotations` table) --------------

export type CrmQuotationStatus =
  "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";

export interface CrmQuotation {
  id: string;
  accountId: string;
  opportunityId?: string;
  quotationNumber: string;
  /** Total amount — kept in sync with `grandTotal` once line items exist; the source of truth for
   *  quotes created before the line-item system, which never wrote the fields below. */
  amount: number;
  description?: string;
  status: CrmQuotationStatus;
  validUntil?: string;
  /** Forward-compatible link for future ERP integration — never written to automatically. */
  linkedSalesQuotationId?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  // --- Quote extension fields (additive) --------------------------------------------------
  contactId?: string;
  subject?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  /** Sum of line item amounts before discount/tax/adjustment (gross). */
  subtotal?: number;
  /** Sum of every line's discount amount. */
  totalDiscount?: number;
  totalTax?: number;
  /** Manual +/- adjustment applied after tax, before grand total. */
  adjustment?: number;
  grandTotal?: number;
  // --- Quote detail / lifecycle extension fields (additive) --------------------------------
  /** Salesperson/owner responsible for this quote — defaults to its creator, editable afterward. */
  quoteOwner?: string;
  /** ISO currency code (e.g. "INR", "USD") the quote's amounts are denominated in. Defaults to "INR". */
  currency?: string;
  /** The date the quote was issued — distinct from `createdAt`, editable. */
  quoteDate?: string;
  /** Customer's own PO number or reference for this quote. */
  customerReference?: string;
  carrier?: string;
  deliveryNotes?: string;
  termsConditions?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  /** Free-text additional notes, separate from the structured terms fields above. */
  notes?: string;
}

export type CrmQuotationInput = Omit<
  CrmQuotation,
  "id" | "createdAt" | "updatedAt" | "createdBy"
>;

// --- Quotation line items (CRM-scoped; own Firebase path, one node per quotation) ---------------

export interface CrmQuotationLineItem {
  id: string;
  quotationId: string;
  productId?: string;
  /** Snapshot of the product's code/SKU at add-time, so a later product rename doesn't affect it. */
  productCode?: string;
  description: string;
  quantity: number;
  /** Unit of measure (e.g. "Nos", "Hrs", "Box") — free text, optional. */
  uom?: string;
  listPrice: number;
  unitPrice: number;
  discountPercent?: number;
  /** quantity * unitPrice * (discountPercent / 100) — snapshot of the computed discount amount. */
  discountAmount?: number;
  taxPercent?: number;
  /** (quantity * unitPrice - discountAmount) * (taxPercent / 100) — snapshot of the computed tax amount. */
  taxAmount?: number;
  /** quantity * unitPrice * (1 - discount/100) * (1 + tax/100) — the line's grand total. */
  amount: number;
}

// --- Products (CRM-scoped catalog; isolated from the unrelated `sales/products` table) ----------

export interface CrmProduct {
  id: string;
  name: string;
  code: string;
  category?: string;
  vendor?: string;
  unitPrice: number;
  taxPercent?: number;
  description?: string;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt?: number;
}

export type CrmProductInput = Omit<
  CrmProduct,
  "id" | "createdAt" | "updatedAt" | "createdBy"
>;

// --- Deal Products (line items attached to an Opportunity/Deal) ---------------------------------

export interface CrmDealProduct {
  id: string;
  opportunityId: string;
  productId: string;
  /** Snapshot of the product name at add-time, so renaming/deleting a product later doesn't blank
   *  out historical deal line items. */
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  /** quantity * unitPrice * (1 - discount/100) * (1 + tax/100) */
  total: number;
  createdBy: string;
  createdAt: number;
}

export type CrmDealProductInput = Omit<
  CrmDealProduct,
  "id" | "createdAt" | "createdBy"
>;

// --- Documents (metadata + link only — no file storage backend exists yet) ----------------------

export interface CrmDocument {
  id: string;
  relatedType: CrmRelatedType;
  relatedId: string;
  name: string;
  link: string;
  notes?: string;
  uploadedBy: string;
  uploadedAt: number;
}

export type CrmDocumentInput = Omit<CrmDocument, "id" | "uploadedAt">;

// --- Sales Quotas / Targets --------------------------------------------------------------------

export type CrmQuotaPeriod = "monthly" | "quarterly";

/** What a quota's target amount is measured against — 'revenue' and 'closedWonValue' are both
 *  monetary sums (kept as separate labels since teams use either term); 'dealsWon' counts deals. */
export type CrmQuotaMetric = "revenue" | "closedWonValue" | "dealsWon";

export interface CrmQuota {
  id: string;
  /** Rep name (matches `CrmOpportunity.ownerName`) this target belongs to. */
  repName: string;
  /** Optional sales team the rep belongs to — informational, does not affect attainment matching. */
  team?: string;
  /** Optional reporting manager name — informational. */
  managerName?: string;
  /** Who set/owns this target (defaults to the creator) — informational. */
  targetOwner?: string;
  period: CrmQuotaPeriod;
  /** 'YYYY-MM' for monthly, 'YYYY-Q<1-4>' for quarterly — sortable, human-readable period key. */
  periodKey: string;
  /** Period boundaries — derived from period+periodKey by default, stored for display/reporting. */
  startDate?: string;
  endDate?: string;
  targetAmount: number;
  /** Defaults to 'closedWonValue' (the original behavior) when absent, for backward compatibility. */
  metric?: CrmQuotaMetric;
  currency?: string;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type CrmQuotaInput = Omit<
  CrmQuota,
  "id" | "createdAt" | "updatedAt" | "createdBy"
>;

// --- Competitors ---------------------------------------------------------------------------

export interface CrmCompetitor {
  id: string;
  name: string;
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  createdBy: string;
  createdAt: number;
}

export type CrmCompetitorInput = Omit<CrmCompetitor, "id" | "createdAt">;

// --- Saved Views (per-user filter/sort presets) ---------------------------------------------

export type CrmSavedViewEntity =
  "accounts" | "contacts" | "pipeline" | "leads" | "quotes";

export interface CrmSavedView {
  id: string;
  entity: CrmSavedViewEntity;
  name: string;
  ownerName: string;
  /** Opaque JSON blob of that page's own filter/sort state — each page knows how to read its own shape. */
  config: string;
  createdAt: number;
}

export type CrmSavedViewInput = Omit<CrmSavedView, "id" | "createdAt">;

// --- Leads (extension fields appended to the existing `crm/leads` sheet — see ../types.ts) -----

export type CrmLeadStatus =
  | "NEW"
  | "CONTACTED"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "FOLLOW_UP"
  | "MEETING_PENDING"
  | "QUALIFIED"
  | "CONVERTED"
  | "LOST";
