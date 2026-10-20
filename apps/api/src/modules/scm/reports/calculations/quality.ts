import type {
  ScmQualityDefect,
  ScmQualityInspection,
  ScmQualityQuarantineRecord,
} from "@/types";
import {
  type DateRange,
  bucketByPeriod,
  groupBy,
  inRange,
  pickGranularity,
} from "../reportHelpers";
import {
  type ReportFilters,
  type Series,
  type TimePoint,
  matchProductInItems,
  matchStatus,
  matchVendor,
  matchWarehouse,
  withKeyLabels,
  withStatusLabels,
} from "./shared";

const RECENT_LIMIT = 20;

export interface QualityInput {
  qualityInspections: ScmQualityInspection[];
  qualityDefects: ScmQualityDefect[];
  qualityQuarantine: ScmQualityQuarantineRecord[];
}

export interface QualityKpis {
  inspectionCount: number;
  passedCount: number;
  partiallyPassedCount: number;
  failedCount: number;
  onHoldCount: number;
  quarantinedCount: number;
  criticalDefectCount: number;
}

export interface QualityReportData {
  kpis: QualityKpis;
  resultDistribution: Series[];
  defectSeverity: Series[];
  defectCategory: Series[];
  trendOverTime: TimePoint[];
  quarantineTrend: TimePoint[];
  recentFailures: ScmQualityInspection[];
  quarantinedItems: ScmQualityQuarantineRecord[];
}

const inspectionDate = (i: ScmQualityInspection) =>
  i.completedAt || i.inspectionDate || i.createdAt;

function selectQuality(
  input: QualityInput,
  range: DateRange,
  filters: ReportFilters,
) {
  const inspections = input.qualityInspections.filter(
    (i) =>
      inRange(inspectionDate(i), range) &&
      matchWarehouse(i.warehouseId, filters) &&
      matchVendor(i.supplierId, filters) &&
      matchStatus(i.result || i.status, filters) &&
      matchProductInItems(i.items, filters),
  );
  return {
    inspections,
    quarantine: input.qualityQuarantine.filter(
      (q) =>
        inRange(q.quarantineDate, range) &&
        matchWarehouse(q.warehouseId, filters),
    ),
    defectByCode: new Map(input.qualityDefects.map((d) => [d.defectCode, d])),
    defectiveItems: inspections.flatMap((i) =>
      i.items.filter(
        (it) =>
          (it.inspectionResult === "FAIL" ||
            it.inspectionResult === "PARTIAL_PASS") &&
          it.defectCode,
      ),
    ),
  };
}

function qualityKpis(sel: ReturnType<typeof selectQuality>): QualityKpis {
  const { inspections, quarantine, defectByCode, defectiveItems } = sel;
  const count = (result: ScmQualityInspection["result"]) =>
    inspections.filter((i) => i.result === result).length;
  return {
    inspectionCount: inspections.length,
    passedCount: count("PASSED"),
    partiallyPassedCount: count("PARTIALLY_PASSED"),
    failedCount: count("FAILED"),
    onHoldCount: count("ON_HOLD"),
    quarantinedCount: quarantine.filter((q) => q.status === "QUARANTINED")
      .length,
    criticalDefectCount: defectiveItems.filter(
      (it) =>
        defectByCode.get(it.defectCode as string)?.severity === "CRITICAL",
    ).length,
  };
}

export function computeQualityKpis(
  input: QualityInput,
  range: DateRange,
  filters: ReportFilters,
): QualityKpis {
  return qualityKpis(selectQuality(input, range, filters));
}

export function computeQualityReport(
  input: QualityInput,
  range: DateRange,
  filters: ReportFilters,
): QualityReportData {
  const sel = selectQuality(input, range, filters);
  const { inspections, quarantine, defectByCode, defectiveItems } = sel;
  const granularity = pickGranularity(range);
  const defectOf = (code: string | undefined) =>
    code ? defectByCode.get(code) : undefined;

  return {
    kpis: qualityKpis(sel),
    resultDistribution: withStatusLabels(groupBy(inspections, (i) => i.result)),
    defectSeverity: withKeyLabels(
      groupBy(
        defectiveItems,
        (it) => defectOf(it.defectCode)?.severity || "UNKNOWN",
      ),
    ),
    defectCategory: withStatusLabels(
      groupBy(
        defectiveItems,
        (it) => defectOf(it.defectCode)?.category || "UNKNOWN",
      ),
    ),
    trendOverTime: bucketByPeriod(inspections, inspectionDate, granularity),
    quarantineTrend: bucketByPeriod(
      quarantine,
      (q) => q.quarantineDate,
      granularity,
    ),
    recentFailures: inspections
      .filter((i) => i.result === "FAILED")
      .sort(
        (a, b) =>
          (b.completedAt || b.createdAt || 0) -
          (a.completedAt || a.createdAt || 0),
      )
      .slice(0, RECENT_LIMIT),
    quarantinedItems: quarantine
      .filter((q) => q.status === "QUARANTINED")
      .sort((a, b) => (b.quarantineDate || 0) - (a.quarantineDate || 0))
      .slice(0, RECENT_LIMIT),
  };
}
