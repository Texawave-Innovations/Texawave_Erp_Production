import type { CrmNotification } from "@texawave-erp/api-types";

/** Shared bucketing (legacy `notificationGrouping.ts`) so the bell and the
 * action panel never disagree about which group a notification is in. */
export type NotificationGroup =
  "Overdue" | "Today" | "Tomorrow" | "Snoozed" | "Upcoming";

export const GROUP_ORDER: NotificationGroup[] = [
  "Overdue",
  "Today",
  "Tomorrow",
  "Snoozed",
  "Upcoming",
];

const DAY_MS = 86_400_000;

/** Whole UTC days from today to the notification's due day (server dates are UTC days). */
export function dueDiffDays(n: CrmNotification): number {
  const due = Math.floor(new Date(n.dueDate).getTime() / DAY_MS);
  const today = Math.floor(Date.now() / DAY_MS);
  return due - today;
}

export function groupFor(n: CrmNotification): NotificationGroup {
  if (n.status === "Snoozed") return "Snoozed";
  const diff = dueDiffDays(n);
  if (n.status === "Overdue" || diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return "Upcoming";
}

export const GROUP_BADGE: Record<NotificationGroup, string> = {
  Overdue:
    "text-error-700 bg-error-50 border-error-200 dark:bg-error-950 dark:text-error-300 dark:border-error-800",
  Today:
    "text-warning-700 bg-warning-50 border-warning-200 dark:bg-warning-950 dark:text-warning-300 dark:border-warning-800",
  Tomorrow:
    "text-brand-700 bg-brand-50 border-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800",
  Snoozed:
    "text-gray-600 bg-gray-100 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  Upcoming:
    "text-success-700 bg-success-50 border-success-200 dark:bg-success-950 dark:text-success-300 dark:border-success-800",
};

export const GROUP_HEADER: Record<NotificationGroup, string> = {
  Overdue: "bg-error-600",
  Today: "bg-warning-500",
  Tomorrow: "bg-brand-500",
  Snoozed: "bg-gray-500",
  Upcoming: "bg-success-600",
};

/** Where clicking a notification navigates (legacy `SOURCE_ROUTES`). */
export function sourceRoute(n: CrmNotification): string {
  switch (n.sourceType) {
    case "opportunity":
      return "/crm/pipeline";
    case "quotation":
      return "/crm/quotes";
    default:
      return n.accountId ? `/crm/accounts/${n.accountId}` : "/crm/accounts";
  }
}

export const SOURCE_LABEL: Record<CrmNotification["sourceType"], string> = {
  meeting: "Meetings",
  followUp: "Follow-ups",
  task: "Tasks",
  opportunity: "Pipeline",
  quotation: "Quotations",
  account: "Accounts",
};

/** Snooze quick-picks (legacy `snoozePresets`): +3 hours, tomorrow 9 AM, next week. */
export function snoozePresets(): { label: string; until: () => Date }[] {
  return [
    {
      label: "+3 hours",
      until: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
    },
    {
      label: "Tomorrow 9 AM",
      until: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Next week",
      until: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  ];
}

/** Legacy `GROUP_STYLE` — the section-header chip colours in the bell. */
export const GROUP_STYLE: Record<NotificationGroup, string> = {
  Overdue: "text-red-600 bg-red-50 border-red-200",
  Today: "text-amber-600 bg-amber-50 border-amber-200",
  Tomorrow: "text-blue-600 bg-blue-50 border-blue-200",
  Snoozed: "text-slate-500 bg-slate-100 border-slate-200",
  Upcoming: "text-emerald-600 bg-emerald-50 border-emerald-200",
};
