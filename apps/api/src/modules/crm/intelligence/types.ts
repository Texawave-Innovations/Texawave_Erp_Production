// CRM Intelligence Layer — shared types.
//
// Everything under `src/modules/crm/intelligence/` is a NEW, purely additive layer on top of
// the existing CRM tabs. It only ever READS the 9 company-level source tabs (Accounts Mining
// Sheet, Cold Calling Status, Leads, Yet to Happen, Call Back-Send Info, Not Interested, Keep in
// Touch, WhatsApp, LinkedIn — "Overall Data" is a daily counter sheet with no company rows, so
// it isn't part of this aggregation) and WRITES only to new, isolated Firebase paths:
// `crm/metadata`, `crm/notes`, and `crm/auditLogs`. It never modifies `crm/overallData`,
// `crm/overallReport`, or any of the 9 source paths, and never touches `crm/notifications/*`.

/** The 9 CRM source tabs that carry company/lead rows (excludes the daily "Overall Data" sheet). */
export type CrmSourceTabKey =
  | "accountsMiningSheet"
  | "coldCalling"
  | "leads"
  | "yetToHappen"
  | "callBackSendInfo"
  | "notInterested"
  | "keepInTouch"
  | "whatsapp"
  | "linkedin";

/** Broad shape of a unified activity, used to decide how it participates in the dashboard/calendar. */
export type CrmActivityKind = "mining" | "meeting" | "followup" | "closed";

/**
 * One row from any of the 8 source tabs, normalized into a common shape for the dashboard,
 * search, calendar, and company 360 view. Purely a read-side projection — never written back
 * to any source tab.
 */
export interface UnifiedCrmActivity {
  id: string;
  companyKey: string;
  sourceTab: CrmSourceTabKey;
  sourceRowId: string;
  activityKind: CrmActivityKind;
  companyName: string;
  domain?: string;
  prospectName?: string;
  title?: string;
  email?: string;
  contactNumber?: string;
  statusText?: string;
  /** Raw text of the row's "date" field (when the entry was logged). */
  entryDateRaw?: string;
  entryDate: Date | null;
  /** Raw text of whichever due-date-like field applies (meetingScheduled/date/nextFollowUp/followUpDate). */
  dueRaw?: string;
  dueDate: Date | null;
  comments?: string;
  isClosedOut: boolean;
  /** Extra tab-specific fields kept for display in the Company 360 view (never fabricated). */
  extra?: Record<string, string | undefined>;
}

/** One company/prospect aggregated across every source tab it appears in — the Company 360 view's data. */
export interface CompanyProfile {
  companyKey: string;
  companyName: string;
  domains: string[];
  activities: UnifiedCrmActivity[];
  tabsPresent: CrmSourceTabKey[];
  contacts: {
    name: string;
    title?: string;
    email?: string;
    contactNumber?: string;
    sourceTab: CrmSourceTabKey;
  }[];
  lastActivity: UnifiedCrmActivity | null;
  nextMeeting: UnifiedCrmActivity | null;
  nextFollowUp: UnifiedCrmActivity | null;
}

export type CrmPriority = "High" | "Medium" | "Low";
export type CrmTemperature = "Hot" | "Warm" | "Cold";

/** New, isolated metadata layer — stored at `crm/metadata/{companyKey}`. Never a column on any source tab. */
export interface CrmMetadata {
  priority?: CrmPriority;
  temperature?: CrmTemperature;
  updatedBy?: string;
  updatedAt?: number;
}

/** New notes layer — stored at `crm/notes/{companyKey}/{noteId}`. */
export interface CrmNote {
  id: string;
  content: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type CrmAuditAction =
  | "priority_changed"
  | "temperature_changed"
  | "note_added"
  | "notification_acknowledged"
  | "notification_done"
  | "notification_snoozed"
  // --- CRM Core Domain audit trail (Feature: full CRM tracking & auditability) ---
  | "lead_created"
  | "lead_updated"
  | "lead_assigned"
  | "lead_status_changed"
  | "lead_converted"
  | "lead_deleted"
  | "mining_promoted_to_lead"
  | "account_created"
  | "account_updated"
  | "account_field_changed"
  /** Set exclusively by `changeCrmAccountStatusTag()` — kept distinct from the generic
   *  `account_field_changed` action so Overall Data can derive Not Interested / Keep in Touch /
   *  Call Back / Send Info daily counts unambiguously from the audit trail. */
  | "account_status_tag_changed"
  | "account_deleted"
  | "contact_added"
  | "contact_updated"
  | "contact_deleted"
  | "activity_logged"
  | "activity_updated"
  | "opportunity_created"
  | "opportunity_updated"
  | "opportunity_owner_changed"
  | "opportunity_stage_changed"
  | "opportunity_value_changed"
  | "opportunity_won"
  | "opportunity_lost"
  | "opportunity_on_hold"
  | "opportunity_reopened"
  | "opportunity_deleted"
  | "followup_created"
  | "followup_completed"
  | "followup_rescheduled"
  | "followup_missed"
  | "followup_cancelled"
  | "followup_deleted"
  | "meeting_scheduled"
  | "meeting_updated"
  | "meeting_completed"
  | "meeting_cancelled"
  | "meeting_rescheduled"
  | "meeting_deleted"
  | "task_created"
  | "task_completed"
  | "task_deleted"
  | "document_added"
  | "document_deleted"
  | "quotation_created"
  | "quotation_updated"
  | "quotation_status_changed"
  | "quotation_deleted"
  | "pipeline_stage_created"
  | "pipeline_stage_updated"
  | "pipeline_stage_deleted"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "deal_product_added"
  | "deal_product_updated"
  | "deal_product_removed"
  | "quotation_items_updated"
  | "quota_created"
  | "quota_updated"
  | "record_deleted"
  | "record_restored"
  // --- Bulk Import / Excel Export ---
  | "bulk_import_completed"
  // --- Cold Calling Status (additive) ---
  | "coldCalling_linked_account"
  | "coldCalling_created_account";

/** New audit trail layer — stored at `crm/auditLogs/{logId}`. Tracks only actions from this layer forward. */
export interface CrmAuditLogEntry {
  id: string;
  companyKey?: string;
  companyName?: string;
  action: CrmAuditAction;
  details: string;
  by: string;
  at: number;
  /** CRM Core Domain fields — optional so the pre-existing legacy audit entries above stay valid. */
  entityType?: string;
  entityId?: string;
  previousValue?: string;
  newValue?: string;
}
