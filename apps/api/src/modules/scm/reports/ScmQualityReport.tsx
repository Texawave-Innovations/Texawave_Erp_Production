import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { useScmReportsData } from "./reportService";
import {
  computeQualityReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import {
  mergeByPeriod,
  presetRange,
  formatNumber,
  colorFor,
} from "./reportHelpers";
import {
  DonutChart,
  ReportFiltersBar,
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "./reportComponents";
import { exportReportCSV } from "./reportExport";

const QUALITY_STATUS_OPTIONS = [
  { value: "PASSED", label: "Passed" },
  { value: "PARTIALLY_PASSED", label: "Partially Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_INSPECTION", label: "Pending Inspection" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ScmQualityReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const warehouseOptions = useMemo(
    () => data.warehouses.map((w) => ({ value: w.id, label: w.name })),
    [data.warehouses],
  );
  const vendorOptions = useMemo(
    () => data.vendors.map((v) => ({ value: v.id, label: v.companyName })),
    [data.vendors],
  );
  const productOptions = useMemo(
    () => data.products.map((p) => ({ value: p.productCode, label: p.name })),
    [data.products],
  );
  const report = useMemo(
    () => computeQualityReport(data, range, filters),
    [data, range, filters],
  );
  const hasData = report.kpis.inspectionCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Quality Report</h2>
        <p className="text-muted-foreground mt-1">
          QC inspection results, defect severity/category mix and quarantine
          trend.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        vendors={vendorOptions}
        products={productOptions}
        statuses={QUALITY_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.recentFailures,
            [
              { key: "inspectionNumber", label: "Inspection #" },
              { key: "inspectionType", label: "Type" },
              { key: "sourceNumber", label: "Source" },
              { key: "result", label: "Result" },
            ],
            "Quality_Report",
          )
        }
        exportDisabled={report.recentFailures.length === 0}
        dateFieldNote="Inspections are filtered by Completed Date (falls back to Inspection Date, then creation date); Quarantine records by Quarantine Date."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState title="No QC records for the selected filters." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <KpiCard
              label="Inspections"
              value={formatNumber(report.kpis.inspectionCount)}
              loading={loading}
            />
            <KpiCard
              label="Passed"
              value={formatNumber(report.kpis.passedCount)}
              loading={loading}
            />
            <KpiCard
              label="Partially Passed"
              value={formatNumber(report.kpis.partiallyPassedCount)}
              loading={loading}
            />
            <KpiCard
              label="Failed"
              value={formatNumber(report.kpis.failedCount)}
              loading={loading}
            />
            <KpiCard
              label="On Hold"
              value={formatNumber(report.kpis.onHoldCount)}
              loading={loading}
            />
            <KpiCard
              label="Quarantined"
              value={formatNumber(report.kpis.quarantinedCount)}
              loading={loading}
            />
            <KpiCard
              label="Critical Defects"
              value={formatNumber(report.kpis.criticalDefectCount)}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  QC Result Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.resultDistribution.length === 0 ? (
                  <ReportEmptyState title="No completed inspections in range." />
                ) : (
                  <DonutChart data={report.resultDistribution} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  QC &amp; Quarantine Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.trendOverTime.length === 0 ? (
                  <ReportEmptyState title="No inspections in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mergeByPeriod({
                        inspections: report.trendOverTime,
                        quarantine: report.quarantineTrend,
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="inspections"
                        stroke={colorFor(0)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="quarantine"
                        stroke={colorFor(3)}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Defect Severity (Failed/Partial Items)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.defectSeverity.length === 0 ? (
                  <ReportEmptyState title="No defects recorded in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.defectSeverity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill={colorFor(4)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Defect Category</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.defectCategory.length === 0 ? (
                  <ReportEmptyState title="No defects recorded in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.defectCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        fontSize={10}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill={colorFor(7)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Failures</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inspection #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.recentFailures.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No failed inspections.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.recentFailures.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">
                              {i.inspectionNumber}
                            </TableCell>
                            <TableCell className="text-xs">
                              {i.inspectionType.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-xs">
                              {i.sourceNumber || i.sourceId}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quarantined Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.quarantinedItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-10 text-muted-foreground"
                          >
                            Nothing in quarantine.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.quarantinedItems.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell>{q.productNameSnapshot}</TableCell>
                            <TableCell className="text-xs">
                              {q.warehouseNameSnapshot || q.warehouseId}
                            </TableCell>
                            <TableCell>{formatNumber(q.quantity)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
