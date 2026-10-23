// Shared grouping logic for the CRM notification feed — used by both the dropdown bell
// (CrmNotificationBell.tsx) and the prominent top action panel (CrmActionPanel.tsx) so the two
// surfaces never disagree about which bucket ("Overdue", "Today", ...) a notification falls into.
import { CrmNotification, CrmNotificationSourceTab } from "./types";
import { diffInDays, parseLooseDate } from "./dateUtils";

export type Group = "Overdue" | "Today" | "Tomorrow" | "Snoozed" | "Upcoming";

export function groupFor(n: CrmNotification): Group {
  if (n.status === "Snoozed") return "Snoozed";
  const due = parseLooseDate(n.dueDate);
  const diff = due ? diffInDays(due) : 0;
  if (n.status === "Overdue" || diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return "Upcoming";
}

export const GROUP_ORDER: Group[] = [
  "Overdue",
  "Today",
  "Tomorrow",
  "Snoozed",
  "Upcoming",
];

export const GROUP_STYLE: Record<Group, string> = {
  Overdue: "text-red-600 bg-red-50 border-red-200",
  Today: "text-amber-600 bg-amber-50 border-amber-200",
  Tomorrow: "text-blue-600 bg-blue-50 border-blue-200",
  Snoozed: "text-slate-500 bg-slate-100 border-slate-200",
  Upcoming: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

/** Where clicking a notification of this source should navigate — shared so the bell dropdown and
 *  the full-screen action panel never disagree about where a given notification's source lives. */
export const SOURCE_ROUTES: Record<CrmNotificationSourceTab, string> = {
  yetToHappen: "/crm/yet-to-happen",
  leads: "/crm/leads",
  callBackSendInfo: "/crm/call-back-send-info",
  keepInTouch: "/crm/keep-in-touch",
  whatsapp: "/crm/whatsapp",
  linkedin: "/crm/linkedin",
  // CRM Core Domain (Accounts/Opportunities) — additive sources, same feed.
  domainMeetings: "/crm/accounts",
  domainFollowUps: "/crm/accounts",
  domainOpportunities: "/crm/pipeline",
  domainQuotations: "/crm/accounts",
};

/** Snooze quick-picks offered by both the bell dropdown and the full-screen action panel — one
 *  definition so adding/changing a preset can't apply to one surface and be forgotten on the other. */
export function snoozePresets(): { label: string; until: () => number }[] {
  return [
    { label: "+3 hours", until: () => Date.now() + 3 * 60 * 60 * 1000 },
    {
      label: "Tomorrow 9 AM",
      until: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d.getTime();
      },
    },
    {
      label: "Next week",
      until: () => Date.now() + 7 * 24 * 60 * 60 * 1000,
    },
  ];
}
