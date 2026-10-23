// HANDWRITTEN — mirrors apps/api/src/modules/crm/dashboard/
// (dashboard.controller.ts, dashboard.service.ts). See
// packages/api-types/README.md.
//
// Every section is `null` when the caller lacks the read permission(s) of
// the entities it is built from (`access` says which they hold).

export interface CrmDashboardAccess {
  opportunities: boolean;
  leads: boolean;
  accounts: boolean;
  meetings: boolean;
  followUps: boolean;
  tasks: boolean;
  quotas: boolean;
  overallData: boolean;
}

export interface CrmDashboardTrendMonth {
  /** yyyy-MM (IST). */
  monthKey: string;
  /** e.g. "Oct 26". */
  label: string;
  pipelineCreated: number;
  wonRevenue: number;
  target: number;
}

export interface CrmDashboardRevenueTrend {
  months: CrmDashboardTrendMonth[];
  totals: {
    pipelineCreated: number;
    wonRevenue: number;
    target: number;
    attainmentPct: number;
  };
}

/** Each count is `null` when the entity behind it is not readable. */
export interface CrmDashboardOverview {
  totalLeads: number | null;
  convertedLeads: number | null;
  interestedLeads: number | null;
  notInterestedCount: number | null;
  pendingFollowUpsCount: number | null;
  scheduledMeetingsCount: number | null;
}

export interface CrmDashboardStageRow {
  stageId: number;
  label: string;
  count: number;
  value: number;
}

export interface CrmDashboardPipeline {
  openCount: number;
  openValue: number;
  weightedValue: number;
  wonCount: number;
  lostCount: number;
  totalRevenue: number;
  winRate: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  dealsAtRisk: number;
  forecastBuckets: { bestCase: number; commit: number; pipeline: number };
  stuckCount: number;
  stageValue: CrmDashboardStageRow[];
  dealHealth: { healthy: number; delayed: number; critical: number };
  stageDuration: { stageId: number; label: string; avgDays: number }[];
  dealAging: { bucket: string; count: number }[];
  lostReasons: { reason: string; count: number }[];
}

export interface CrmDashboardTeamRow {
  repName: string;
  won: number;
  wonValue: number;
  open: number;
  lost: number;
  winRate: number;
  /** Target of the rep's first quota (legacy `quotas.find`). */
  target: number | null;
  /** All-time won value vs `target` (legacy), not the period figure. */
  attainmentPct: number | null;
  /** Current-period attainment via the shared quota-attainment math. */
  quotaLive: {
    period: string;
    periodKey: string;
    status: string;
    attainmentPct: number;
  } | null;
}

export interface CrmDashboardLeadSource {
  source: string;
  total: number;
  converted: number;
}

export interface CrmDashboardLeadsTrend {
  granularity: "Daily" | "Weekly" | "Monthly" | null;
  points: { label: string; total: number; converted: number }[];
}

export interface CrmDashboardWorkItem {
  id: string;
  kind: "Meeting" | "Follow-up" | "Task";
  title: string;
  accountId: number | null;
  accountName: string | null;
  /** ISO timestamp (date-only entities are midnight UTC of their date). */
  dueAt: string;
  owner: string | null;
  /** Page to open on click. */
  href: string;
}

export interface CrmDashboardWorkBucket {
  count: number;
  items: CrmDashboardWorkItem[];
}

export type CrmDashboardWorkBucketKey =
  | "todaysMeetings"
  | "todaysFollowups"
  | "todaysCallbacks"
  | "needsAttention"
  | "tomorrowMeetings"
  | "upcomingFollowups"
  | "overdue"
  | "missedFollowups"
  | "pending";

export type CrmDashboardWork = Record<
  CrmDashboardWorkBucketKey,
  CrmDashboardWorkBucket
>;

export interface CrmDashboardHealth {
  activitiesCompleted: number | null;
  todayDateKey: string;
  today: {
    accountsMined: number;
    emailsSent: number;
    callsMade: number;
    meetingsScheduled: number;
    meetingsCompleted: number;
    meetingsCancelled: number;
  } | null;
  dailyTrend:
    | {
        dateKey: string;
        label: string;
        accountsMined: number;
        callsMade: number;
        emailsSent: number;
      }[]
    | null;
}

export interface CrmDashboard {
  generatedAt: string;
  access: CrmDashboardAccess;
  revenueTrend: CrmDashboardRevenueTrend | null;
  overview: CrmDashboardOverview;
  pipeline: CrmDashboardPipeline | null;
  accountsCount: number | null;
  team: CrmDashboardTeamRow[] | null;
  leadSources: CrmDashboardLeadSource[] | null;
  leadsTrend: CrmDashboardLeadsTrend | null;
  productRevenue: { product: string; value: number }[] | null;
  work: CrmDashboardWork;
  health: CrmDashboardHealth;
}
