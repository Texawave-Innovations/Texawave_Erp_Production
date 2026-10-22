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
import { useScmReportsData } from "./reportService";
import {
  computeFulfillmentReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import {
  mergeByPeriod,
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

const FULFILLMENT_STATUS_OPTIONS = [
  "PENDING",
  "STOCK_CHECK",
  "PARTIALLY_AVAILABLE",
  "AVAILABLE",
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
  "FULFILLED",
  "CANCELLED",
  "ON_HOLD",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

export default function ScmFulfillmentReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const warehouseOptions = useMemo(
    () => data.warehouses.map((w) => ({ value: w.id, label: w.name })),
    [data.warehouses],
  );
  const productOptions = useMemo(
    () => data.products.map((p) => ({ value: p.productCode, label: p.name })),
    [data.products],
  );
  const report = useMemo(
    () => computeFulfillmentReport(data, range, filters),
    [data, range, filters],
  );
  const hasData =
    report.kpis.fulfillmentCount > 0 || report.kpis.salesOrderCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Fulfillment Report
        </h2>
        <p className="text-muted-foreground mt-1">
          Order fulfillment progress, backorders and availability.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        products={productOptions}
        statuses={FULFILLMENT_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.topProductsByFulfilledQty,
            [
              { key: "label", label: "Product" },
              { key: "value", label: "Fulfilled Quantity" },
            ],
            "Fulfillment_Report",
          )
        }
        exportDisabled={report.topProductsByFulfilledQty.length === 0}
        dateFieldNote="Fulfillment orders are filtered by their creation date; Sales Orders by SO Date (falls back to creation date when unset)."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState title="No fulfillment activity for the selected filters." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Sales Orders"
              value={formatNumber(report.kpis.salesOrderCount)}
              loading={loading}
            />
            <KpiCard
              label="Fulfillment Orders"
              value={formatNumber(report.kpis.fulfillmentCount)}
              loading={loading}
            />
            <KpiCard
              label="Allocated Qty"
              value={formatNumber(report.kpis.allocatedQty)}
              loading={loading}
            />
            <KpiCard
              label="Issued Qty"
              value={formatNumber(report.kpis.issuedQty)}
              loading={loading}
            />
            <KpiCard
              label="Ordered Qty"
              value={formatNumber(report.kpis.orderedQty)}
              loading={loading}
            />
            <KpiCard
              label="Completed Fulfillments"
              value={formatNumber(report.kpis.completedCount)}
              loading={loading}
            />
            <KpiCard
              label="Backorders"
              value={formatNumber(report.kpis.backorderCount)}
              loading={loading}
            />
            <KpiCard
              label="Fulfillment Completion Rate"
              loading={loading}
              value={formatPercent(report.kpis.completionRatePercent)}
              unavailable={report.kpis.completionRatePercent == null}
              hint="Issued quantity ÷ ordered quantity × 100"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Fulfillment Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.statusDistribution.length === 0 ? (
                  <ReportEmptyState title="No fulfillment orders in range." />
                ) : (
                  <DonutChart data={report.statusDistribution} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Fulfillment Volume &amp; Backorder Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.volumeOverTime.length === 0 ? (
                  <ReportEmptyState title="No fulfillment orders in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mergeByPeriod({
                        total: report.volumeOverTime,
                        backorders: report.backorderTrend,
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Fulfillment Orders"
                        stroke={colorFor(0)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="backorders"
                        name="Backordered"
                        stroke={colorFor(4)}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Top Products by Fulfilled Quantity
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.topProductsByFulfilledQty.length === 0 ? (
                  <ReportEmptyState title="No items fulfilled in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.topProductsByFulfilledQty}
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
                        fill={colorFor(2)}
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
