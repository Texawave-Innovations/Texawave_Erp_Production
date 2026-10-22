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
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useScmReportsData } from "./reportService";
import {
  computeProcurementReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import { formatCurrency } from "../shared/format";
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

const PO_STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
  "CLOSED",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const CHART_TOP_N = 10;

export default function ScmProcurementReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");

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
    () => computeProcurementReport(data, range, filters),
    [data, range, filters],
  );

  const recentPOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report.recentPOs;
    return report.recentPOs.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.vendorNameSnapshot.toLowerCase().includes(q),
    );
  }, [report.recentPOs, search]);

  const hasData =
    report.kpis.poCount > 0 ||
    report.kpis.prCount > 0 ||
    report.kpis.grnCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Procurement Report
        </h2>
        <p className="text-muted-foreground mt-1">
          Purchase analysis, PR → RFQ → PO → GRN pipeline volume and receipt
          status.
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
        statuses={PO_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.recentPOs,
            [
              { key: "poNumber", label: "PO Number" },
              { key: "vendorNameSnapshot", label: "Supplier" },
              { key: "poDate", label: "PO Date" },
              { key: "status", label: "Status" },
              { key: "total", label: "Total" },
            ],
            "Procurement_Report",
          )
        }
        exportDisabled={report.recentPOs.length === 0}
        dateFieldNote="Purchase Orders are filtered by PO Date; Requisitions by Request Date; GRNs by Receipt Date (each falls back to its creation date when unset)."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState
          title="No procurement data for the selected filters."
          subtitle="Adjust the date range or filters, or create a purchase requisition to get started."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            <KpiCard
              label="Purchase Requisitions"
              value={formatNumber(report.kpis.prCount)}
              loading={loading}
            />
            <KpiCard
              label="RFQs"
              value={formatNumber(report.kpis.rfqCount)}
              loading={loading}
            />
            <KpiCard
              label="Supplier Quotations"
              value={formatNumber(report.kpis.quotationCount)}
              loading={loading}
            />
            <KpiCard
              label="Purchase Orders"
              value={formatNumber(report.kpis.poCount)}
              loading={loading}
            />
            <KpiCard
              label="PO Value"
              value={formatCurrency(report.kpis.poValue)}
              loading={loading}
            />
            <KpiCard
              label="Approved PO Value"
              value={formatCurrency(report.kpis.approvedPoValue)}
              loading={loading}
            />
            <KpiCard
              label="Pending PO Approvals"
              value={formatNumber(report.kpis.pendingPoCount)}
              loading={loading}
            />
            <KpiCard
              label="GRNs"
              value={formatNumber(report.kpis.grnCount)}
              loading={loading}
            />
            <KpiCard
              label="Received Quantity"
              value={formatNumber(report.kpis.receivedQty)}
              loading={loading}
            />
            <KpiCard
              label="Pending Receipt Qty"
              value={formatNumber(report.kpis.pendingReceiptQty)}
              loading={loading}
            />
            <KpiCard
              label="Avg. PR → PO Time"
              value={formatDays(report.kpis.avgPrToPoDays)}
              unavailable={report.kpis.avgPrToPoDays == null}
              loading={loading}
              hint="Requires 3+ requisitions converted to a PO"
            />
            <KpiCard
              label="Avg. PO → GRN Time"
              value={formatDays(report.kpis.avgPoToGrnDays)}
              unavailable={report.kpis.avgPoToGrnDays == null}
              loading={loading}
              hint="Requires 3+ POs with a matching GRN"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Purchase Orders &amp; Value Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.posOverTime.length === 0 ? (
                  <ReportEmptyState title="No purchase orders in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mergeByPeriod({
                        value: report.poValueOverTime,
                        count: report.posOverTime,
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        fontSize={11}
                      />
                      <Tooltip
                        formatter={(v: number, name) =>
                          name === "PO Value" ? formatCurrency(v) : v
                        }
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="value"
                        name="PO Value"
                        stroke={colorFor(0)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="count"
                        name="PO Count"
                        stroke={colorFor(1)}
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
                  Purchase Order Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.statusDistribution.length === 0 ? (
                  <ReportEmptyState title="No purchase orders in range." />
                ) : (
                  <DonutChart data={report.statusDistribution} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top Suppliers by PO Value
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.topSuppliersByValue.length === 0 ? (
                  <ReportEmptyState title="No purchase orders in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.topSuppliersByValue}
                      layout="vertical"
                      margin={{ left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        fontSize={11}
                        tickFormatter={(v: number) =>
                          formatCurrency(v, "INR", 0)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        fontSize={11}
                        width={140}
                      />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Pending Receipt Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.pendingReceipts.length === 0 ? (
                  <ReportEmptyState title="Nothing pending receipt." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.pendingReceipts.slice(0, CHART_TOP_N)}
                      layout="vertical"
                      margin={{ left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="poNumber"
                        fontSize={11}
                        width={100}
                      />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar
                        dataKey="pendingQty"
                        name="Pending Qty"
                        fill={colorFor(3)}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">
                  Recent Purchase Orders
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search PO # or supplier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>PO Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPOs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No purchase orders match.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPOs.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">
                            {p.poNumber}
                          </TableCell>
                          <TableCell>{p.vendorNameSnapshot}</TableCell>
                          <TableCell>{p.poDate}</TableCell>
                          <TableCell className="text-xs">
                            {p.status.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(p.total)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
