// HANDWRITTEN — mirrors
// apps/api/src/modules/crm/crm-notifications/ (controller, DTOs, rules). See
// packages/api-types/README.md.

export type CrmNotificationType =
  | "meeting-tomorrow"
  | "meeting-today"
  | "meeting-overdue"
  | "meeting-rescheduled"
  | "followup-due"
  | "followup-overdue"
  | "task-due"
  | "task-overdue"
  | "callback-due"
  | "callback-overdue"
  | "keepintouch-due"
  | "keepintouch-overdue"
  | "opportunity-stuck"
  | "quotation-pending"
  | "expected-close-near";

export type CrmNotificationSourceType =
  "meeting" | "followUp" | "task" | "opportunity" | "quotation" | "account";

export type CrmNotificationStatus =
  "Pending" | "Acknowledged" | "Done" | "Snoozed" | "Overdue";

export type CrmNotificationPriority = "high" | "medium" | "low";

export type CrmNotificationTab = "active" | "completed" | "deleted";

/** Legacy `notifications/types.ts` `CrmNotification`, relational form. */
export interface CrmNotification {
  id: number;
  organizationId: number;
  sourceType: CrmNotificationSourceType;
  sourceId: number;
  type: CrmNotificationType;
  title: string;
  description: string | null;
  accountId: number | null;
  companyName: string | null;
  prospectName: string | null;
  /** ISO timestamp at UTC midnight of the due day. */
  dueDate: string;
  status: CrmNotificationStatus;
  priority: CrmNotificationPriority;
  isRead: boolean;
  acknowledgedAt: string | null;
  completedAt: string | null;
  snoozeUntil: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CrmNotificationCounts {
  active: number;
  unread: number;
  completed: number;
  deleted: number;
}

export interface CrmNotificationFeed {
  items: CrmNotification[];
  counts: CrmNotificationCounts;
}

export interface CrmNotificationRefreshResult {
  created: number;
  updated: number;
  candidates: number;
}

export interface SnoozeCrmNotificationInput {
  /** ISO timestamp, in the future (max 90 days). */
  until: string;
}
