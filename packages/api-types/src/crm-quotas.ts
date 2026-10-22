// HANDWRITTEN — mirrors apps/api/src/modules/crm/quotas/dto/quota.dto.ts
// and quotas.controller.ts. See packages/api-types/README.md.

export type CrmQuotaPeriod = "monthly" | "quarterly";
export type CrmQuotaMetric = "revenue" | "closedWonValue" | "dealsWon";
export type CrmQuotaStatus = "Achieved" | "On Track" | "At Risk" | "Behind";

/** Computed on read from WON opportunities (legacy `CrmQuotaLiveSummary`). */
export interface CrmQuotaLiveSummary {
  target: number;
  achieved: number;
  remaining: number;
  attainmentPct: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  requiredDailyRunRate: number;
  forecast: number;
  status: CrmQuotaStatus;
}

export interface CrmQuota {
  id: number;
  organizationId: number;
  repName: string;
  team: string | null;
  managerName: string | null;
  targetOwner: string | null;
  period: CrmQuotaPeriod;
  periodKey: string;
  startDate: string | null;
  endDate: string | null;
  targetAmount: number;
  metric: CrmQuotaMetric;
  currency: string | null;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  live: CrmQuotaLiveSummary;
}

export interface CreateCrmQuotaInput {
  repName: string;
  team?: string | undefined;
  managerName?: string | undefined;
  targetOwner?: string | undefined;
  period: CrmQuotaPeriod;
  periodKey: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  targetAmount: number;
  metric?: CrmQuotaMetric | undefined;
  currency?: string | undefined;
  notes?: string | undefined;
}

export type UpdateCrmQuotaInput = Partial<CreateCrmQuotaInput>;

export interface QueryCrmQuotasInput {
  page?: number | undefined;
  limit?: number | undefined;
  repName?: string | undefined;
  period?: CrmQuotaPeriod | undefined;
  periodKey?: string | undefined;
}

export interface CrmQuotaLiveSummaryInput {
  repName: string;
  period: CrmQuotaPeriod;
  periodKey: string;
  targetAmount: number;
  metric?: CrmQuotaMetric | undefined;
}
