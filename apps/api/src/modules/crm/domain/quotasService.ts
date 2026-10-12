// CRM Core Domain — Sales Quotas / Targets. Isolated Firebase path: `crm/quotas`.
//
// Attainment is deliberately NOT stored as an incrementing counter on the quota record — it's
// computed on read by summing that rep's Won opportunities whose `wonAt` falls inside the
// quota's period, the same "computed, not stored" approach `getEffectiveFollowUpStatus` already
// uses elsewhere in this module. That avoids write races between concurrent Win actions and
// means a quota's attainment is always correct even if `markCrmOpportunityWon` fires from
// several places, rather than depending on every one of them remembering to increment a counter.
import { CRM_QUOTAS_PATH } from "./config";
import {
  createInCollection,
  subscribeCollection,
  updateInCollection,
} from "./firebaseCollection";
import {
  CrmOpportunity,
  CrmQuota,
  CrmQuotaInput,
  CrmQuotaPeriod,
} from "./types";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { softDeleteCrmRecord } from "./recycleBinService";
import { User } from "@/types";

export function subscribeCrmQuotas(
  callback: (quotas: CrmQuota[]) => void,
): () => void {
  return subscribeCollection<CrmQuota>(CRM_QUOTAS_PATH, (items) => {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(items);
  });
}

export async function createCrmQuota(
  input: CrmQuotaInput,
  createdBy: string,
): Promise<string> {
  const id = await createInCollection<CrmQuota>(CRM_QUOTAS_PATH, {
    ...input,
    createdBy,
    createdAt: Date.now(),
  } as Omit<CrmQuota, "id">);
  await writeCrmAuditLog({
    action: "quota_created",
    entityType: "quota",
    entityId: id,
    details: `Quota set for ${input.repName} — ${input.period} ${input.periodKey}, target ₹${input.targetAmount.toLocaleString("en-IN")}`,
    by: createdBy,
    at: Date.now(),
  });
  return id;
}

export async function updateCrmQuota(
  id: string,
  data: Partial<CrmQuota>,
  by: string,
): Promise<void> {
  await updateInCollection(CRM_QUOTAS_PATH, id, {
    ...data,
    updatedAt: Date.now(),
  });
  await writeCrmAuditLog({
    action: "quota_updated",
    entityType: "quota",
    entityId: id,
    details: "Quota updated",
    by,
    at: Date.now(),
  });
}

export async function deleteCrmQuota(
  id: string,
  user: User | null | undefined,
): Promise<void> {
  const deleted = await softDeleteCrmRecord(
    "quota",
    "Quota",
    CRM_QUOTAS_PATH,
    id,
    user,
  );
  if (!deleted) return;
  await writeCrmAuditLog({
    action: "record_deleted",
    entityType: "quota",
    entityId: id,
    details: "Quota moved to Recycle Bin",
    by: user?.name || user?.username || "Unknown",
    at: Date.now(),
  });
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentQuarterKey(date = new Date()): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

/** Whether a Won opportunity's `wonAt` timestamp falls inside a given quota's period. */
function wonWithinPeriod(
  wonAt: number,
  period: "monthly" | "quarterly",
  periodKey: string,
): boolean {
  const d = new Date(wonAt);
  return period === "monthly"
    ? currentMonthKey(d) === periodKey
    : currentQuarterKey(d) === periodKey;
}

/** Sum of Closed Won value (or count of Closed Won deals, for the 'dealsWon' metric) credited to
 *  `repName` within `quota`'s period — the live "attainment" number, computed from the
 *  opportunities already loaded by the caller (no extra Firebase read). `ownerName`/`repName` are
 *  both free-text fields (there's no controlled rep picklist anywhere in this CRM), so the match
 *  is trim+case-insensitive — the same tolerance `canManageOpportunity` already applies to
 *  owner-name comparisons — to avoid a quota silently reading as 0% attainment over a
 *  casing/whitespace difference. */
export function computeQuotaAttainment(
  quota: CrmQuota,
  opportunities: CrmOpportunity[],
): number {
  const targetRep = quota.repName.trim().toLowerCase();
  const wonDeals = opportunities.filter(
    (o) =>
      o.status === "WON" &&
      o.ownerName?.trim().toLowerCase() === targetRep &&
      o.wonAt &&
      wonWithinPeriod(o.wonAt, quota.period, quota.periodKey),
  );
  if (quota.metric === "dealsWon") return wonDeals.length;
  return wonDeals.reduce(
    (sum, o) => sum + (o.closingAmount ?? o.estimatedValue ?? 0),
    0,
  );
}

/** Calendar bounds of a quota's period, derived from `period` + `periodKey`. Returns null for an
 *  invalid/mistyped periodKey rather than an Invalid Date, so callers can surface a clear
 *  validation message instead of "NaN" days. */
export function getPeriodBounds(
  period: CrmQuotaPeriod,
  periodKey: string,
): { start: Date; end: Date } | null {
  let start: Date;
  let end: Date;
  if (period === "monthly") {
    const [y, m] = periodKey.split("-").map(Number);
    start = new Date(y, (m || 1) - 1, 1);
    end = new Date(y, m, 0, 23, 59, 59);
  } else {
    const [yStr, qStr] = periodKey.split("-Q");
    const y = Number(yStr);
    const q = Number(qStr);
    start = new Date(y, (q - 1) * 3, 1);
    end = new Date(y, q * 3, 0, 23, 59, 59);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

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
  status: "Achieved" | "On Track" | "At Risk" | "Behind";
}

/** Full live quota summary (target/achieved/remaining/pace/forecast/status) used by the Set
 *  Target form's read-only summary panel. Kept separate from the existing card/detail-view math
 *  in Quotas.tsx so this additive feature can't change any previously-shipped displayed numbers. */
export function computeQuotaLiveSummary(
  quota: CrmQuota,
  opportunities: CrmOpportunity[],
): CrmQuotaLiveSummary {
  const achieved = computeQuotaAttainment(quota, opportunities);
  const target = quota.targetAmount;
  const remaining = Math.max(0, target - achieved);
  const attainmentPct = target > 0 ? Math.round((achieved / target) * 100) : 0;
  const bounds = getPeriodBounds(quota.period, quota.periodKey);

  let daysRemaining = 0;
  let daysElapsed = 0;
  let totalDays = 0;
  if (bounds) {
    const now = Date.now();
    totalDays = Math.max(
      1,
      Math.round((bounds.end.getTime() - bounds.start.getTime()) / 86400000) +
        1,
    );
    daysRemaining = Math.max(
      0,
      Math.ceil((bounds.end.getTime() - now) / 86400000),
    );
    daysElapsed = Math.min(totalDays, Math.max(0, totalDays - daysRemaining));
  }

  const requiredDailyRunRate =
    daysRemaining > 0 ? remaining / daysRemaining : remaining;
  const actualDailyRunRate = daysElapsed > 0 ? achieved / daysElapsed : 0;
  const forecast = daysElapsed > 0 ? actualDailyRunRate * totalDays : achieved;

  let status: CrmQuotaLiveSummary["status"];
  if (target <= 0) {
    status = "On Track";
  } else if (achieved >= target) {
    status = "Achieved";
  } else if (daysRemaining <= 0) {
    status = "Behind";
  } else {
    const expectedPct =
      totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;
    status =
      attainmentPct >= expectedPct
        ? "On Track"
        : attainmentPct >= expectedPct * 0.7
          ? "At Risk"
          : "Behind";
  }

  return {
    target,
    achieved,
    remaining,
    attainmentPct,
    daysRemaining,
    daysElapsed,
    totalDays,
    requiredDailyRunRate,
    forecast,
    status,
  };
}
