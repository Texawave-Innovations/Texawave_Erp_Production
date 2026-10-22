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
  computeLogisticsReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import {
  mergeByPeriod,
  presetRange,
  formatNumber,
  formatDays,
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

const SHIPMENT_STATUS_OPTIONS = [
  "DRAFT",
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
  "CANCELLED",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const TABLE_ROWS = 10;

export default function ScmLogisticsReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const warehouseOptions = useMemo(
    () => data.warehouses.map((w) => ({ value: w.id, label: w.name })),
    [data.warehouses],
  );
  const report = useMemo(
    () => computeLogisticsReport(data, range, filters),
    [data, range, filters],
  );
  const hasData = report.kpis.shipmentCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Logistics Report</h2>
        <p className="text-muted-foreground mt-1">
          Shipment status, delivery exceptions and carrier volume.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        statuses={SHIPMENT_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.recentShipments,
            [
              { key: "shipmentNumber", label: "Shipment #" },
              { key: "customerNameSnapshot", label: "Customer" },
              { key: "carrierNameSnapshot", label: "Carrier" },
              { key: "status", label: "Status" },
              { key: "shipmentDate", label: "Shipment Date" },
              { key: "actualDeliveryDate", label: "Delivered" },
            ],
            "Logistics_Report",
          )
        }
        exportDisabled={report.recentShipments.length === 0}
        dateFieldNote="Shipments are filtered by Shipment Date (falls back to creation date when unset); delivery exceptions by when they occurred."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState title="No shipments for the selected filters." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Shipments"
              value={formatNumber(report.kpis.shipmentCount)}
              loading={loading}
            />
            <KpiCard
              label="Pending"
              value={formatNumber(report.kpis.pendingCount)}
              loading={loading}
              hint="Not yet handed to the carrier"
            />
            <KpiCard
              label="In Transit"
              value={formatNumber(report.kpis.inTransitCount)}
              loading={loading}
              hint="Dispatched, in transit or out for delivery"
            />
            <KpiCard
              label="Delivered"
              value={formatNumber(report.kpis.deliveredCount)}
              loading={loading}
            />
            <KpiCard
              label="Delivery Problems"
              value={formatNumber(report.kpis.problemCount)}
              loading={loading}
              hint="Delivery exception or failed delivery"
            />
            <KpiCard
              label="Cancelled"
              value={formatNumber(report.kpis.cancelledCount)}
              loading={loading}
            />
            <KpiCard
              label="Shipment Exceptions"
              value={formatNumber(report.kpis.exceptionCount)}
              loading={loading}
            />
            <KpiCard
              label="Avg. Delivery Time"
              loading={loading}
              value={formatDays(report.kpis.avgDeliveryDays)}
              unavailable={report.kpis.avgDeliveryDays == null}
              hint={
                report.kpis.avgDeliveryDays == null
                  ? "Delivery duration unavailable — needs 3+ dispatched-and-delivered shipments"
                  : "Dispatched → Delivered"
              }
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Shipment Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.statusDistribution.length === 0 ? (
                  <ReportEmptyState title="No shipments in range." />
                ) : (
                  <DonutChart data={report.statusDistribution} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Shipments &amp; Exceptions Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.shipmentsOverTime.length === 0 ? (
                  <ReportEmptyState title="No shipments in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mergeByPeriod({
                        shipments: report.shipmentsOverTime,
                        exceptions: report.exceptionTrend,
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="shipments"
                        stroke={colorFor(0)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="exceptions"
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
                <CardTitle className="text-base">Carrier Volume</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.carrierVolume.length === 0 ? (
                  <ReportEmptyState title="No shipments in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.carrierVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar
                        dataKey="value"
                        name="Shipments"
                        fill={colorFor(6)}
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
                <CardTitle className="text-base">Recent Shipments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.recentShipments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No shipments.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.recentShipments.slice(0, TABLE_ROWS).map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">
                              {s.shipmentNumber}
                            </TableCell>
                            <TableCell>{s.customerNameSnapshot}</TableCell>
                            <TableCell className="text-xs">
                              {s.status.replace(/_/g, " ")}
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
                <CardTitle className="text-base">Open Exceptions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.openExceptions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No open exceptions.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.openExceptions.slice(0, TABLE_ROWS).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-mono text-xs">
                              {e.shipmentId}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.exceptionCode.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {e.description}
                            </TableCell>
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
