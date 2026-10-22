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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScmReportsData } from "./reportService";
import {
  computeReturnsReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import {
  presetRange,
  formatNumber,
  formatPercent,
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

const RETURN_STATUS_OPTIONS = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "READY_TO_SHIP",
  "SHIPPED",
  "RECEIVED",
  "VENDOR_RECEIVED",
  "INSPECTION_PENDING",
  "INSPECTED",
  "DISPOSITION_PENDING",
  "COMPLETED",
  "CANCELLED",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

export default function ScmReturnsReport() {
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
    () => computeReturnsReport(data, range, filters),
    [data, range, filters],
  );
  const hasData =
    report.kpis.customerReturnCount > 0 || report.kpis.vendorReturnCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Returns Report</h2>
        <p className="text-muted-foreground mt-1">
          Customer and vendor return volume, reasons, dispositions and return
          rate.
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
        statuses={RETURN_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.topReturnedProducts,
            [
              { key: "label", label: "Product" },
              { key: "value", label: "Returned Quantity" },
            ],
            "Returns_Report",
          )
        }
        exportDisabled={report.topReturnedProducts.length === 0}
        dateFieldNote="Returns are filtered by Requested Date."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState title="No returns in the selected period." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Customer Returns"
              value={formatNumber(report.kpis.customerReturnCount)}
              loading={loading}
            />
            <KpiCard
              label="Vendor Returns"
              value={formatNumber(report.kpis.vendorReturnCount)}
              loading={loading}
            />
            <KpiCard
              label="Pending Approval"
              value={formatNumber(report.kpis.pendingApprovalCount)}
              loading={loading}
            />
            <KpiCard
              label="In Transit"
              value={formatNumber(report.kpis.inTransitCount)}
              loading={loading}
            />
            <KpiCard
              label="Received"
              value={formatNumber(report.kpis.receivedCount)}
              loading={loading}
            />
            <KpiCard
              label="Completed"
              value={formatNumber(report.kpis.completedCount)}
              loading={loading}
            />
            <KpiCard
              label="Rejected"
              value={formatNumber(report.kpis.rejectedCount)}
              loading={loading}
            />
            <KpiCard
              label="Restocked Qty"
              value={formatNumber(report.kpis.restockedQty)}
              loading={loading}
            />
            <KpiCard
              label="Quarantined Qty"
              value={formatNumber(report.kpis.quarantinedQty)}
              loading={loading}
            />
            <KpiCard
              label="Damaged Qty"
              value={formatNumber(report.kpis.damagedQty)}
              loading={loading}
            />
            <KpiCard
              label="Scrap Qty"
              value={formatNumber(report.kpis.scrapQty)}
              loading={loading}
            />
            <KpiCard
              label="Customer Return Rate"
              loading={loading}
              value={formatPercent(report.kpis.customerReturnRatePercent)}
              unavailable={report.kpis.customerReturnRatePercent == null}
              hint="Completed customer-return qty ÷ fulfilled qty in period"
            />
            <KpiCard
              label="Vendor Return Rate"
              loading={loading}
              value={formatPercent(report.kpis.vendorReturnRatePercent)}
              unavailable={report.kpis.vendorReturnRatePercent == null}
              hint="Completed vendor-return qty ÷ GRN accepted qty in period"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Returns Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.returnsOverTime.length === 0 ? (
                  <ReportEmptyState title="No returns in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.returnsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Returns"
                        stroke={colorFor(0)}
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
                  Customer vs Vendor Returns
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <DonutChart data={report.customerVsVendor} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Return Reason Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.reasonDistribution.length === 0 ? (
                  <ReportEmptyState title="No returns in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.reasonDistribution}>
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
                        fill={colorFor(3)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Disposition Distribution (Quantity)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.dispositionDistribution.length === 0 ? (
                  <ReportEmptyState title="No dispositions recorded yet." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.dispositionDistribution}>
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
                        fill={colorFor(5)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Top Returned Products
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.topReturnedProducts.length === 0 ? (
                  <ReportEmptyState title="No returns in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.topReturnedProducts}
                      layout="vertical"
                      margin={{ left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        fontSize={11}
                        width={160}
                      />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar
                        dataKey="value"
                        fill={colorFor(6)}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
