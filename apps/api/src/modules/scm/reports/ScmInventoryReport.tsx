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
  computeInventoryReport,
  EMPTY_FILTERS,
  type ReportFilters,
} from "./calculations";
import { formatCurrency } from "../shared/format";
import { presetRange, formatNumber, colorFor } from "./reportHelpers";
import {
  DonutChart,
  ReportFiltersBar,
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "./reportComponents";
import { exportReportCSV } from "./reportExport";

const STOCK_STATUS_OPTIONS = [
  { value: "Out of Stock", label: "Out of Stock" },
  { value: "Low Stock", label: "Low Stock" },
  { value: "Healthy", label: "Healthy" },
  { value: "Overstock", label: "Overstock" },
];

const MOVEMENT_KEYS = [
  "Inbound",
  "Outbound",
  "Transfers",
  "Returns",
  "Adjustments",
  "Damage",
  "Quarantine",
] as const;

export default function ScmInventoryReport() {
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
    () => computeInventoryReport(data, range, filters),
    [data, range, filters],
  );
  const hasData = report.kpis.totalSkuCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Inventory Report</h2>
        <p className="text-muted-foreground mt-1">
          Stock valuation, category mix, movement trend and low/out-of-stock
          exposure.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        products={productOptions}
        statuses={STOCK_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            report.lowStockItems,
            [
              { key: "productCode", label: "SKU" },
              { key: "productName", label: "Product" },
              { key: "warehouseName", label: "Warehouse" },
              { key: "available", label: "Available" },
              { key: "reorderLevel", label: "Reorder Level" },
            ],
            "Inventory_LowStock_Report",
          )
        }
        exportDisabled={report.lowStockItems.length === 0}
        dateFieldNote="Stock balances (units, value, low/out-of-stock) are current, point-in-time figures. Only the Stock Movement Trend chart below is filtered by the selected date range, using each ledger entry's transaction date."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState
          title="No inventory data for the selected filters."
          subtitle="Post an opening balance under Inventory → Stock Overview to get started."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total SKUs"
              value={formatNumber(report.kpis.totalSKUs)}
              loading={loading}
            />
            <KpiCard
              label="Total Stock Units"
              value={formatNumber(report.kpis.totalUnits)}
              loading={loading}
            />
            <KpiCard
              label="Inventory Value"
              loading={loading}
              value={
                report.kpis.inventoryValue == null
                  ? "Inventory value unavailable"
                  : formatCurrency(report.kpis.inventoryValue)
              }
              unavailable={report.kpis.inventoryValue == null}
              hint={
                report.kpis.inventoryValue == null
                  ? "Set cost price under Inventory Settings"
                  : `Costed for ${report.kpis.valuedSkuCount} of ${report.kpis.totalSkuCount} SKU/warehouse rows · onHand × unit cost`
              }
            />
            <KpiCard
              label="Available Stock"
              value={formatNumber(report.kpis.available)}
              loading={loading}
            />
            <KpiCard
              label="Reserved Stock"
              value={formatNumber(report.kpis.reserved)}
              loading={loading}
            />
            <KpiCard
              label="Incoming Stock"
              value={formatNumber(report.kpis.incoming)}
              loading={loading}
            />
            <KpiCard
              label="Low Stock Items"
              value={formatNumber(report.kpis.lowStockCount)}
              loading={loading}
            />
            <KpiCard
              label="Out of Stock Items"
              value={formatNumber(report.kpis.outOfStockCount)}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Inventory Value by Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.valueByWarehouse == null ? (
                  <ReportEmptyState
                    title="Inventory value unavailable."
                    subtitle="No SKU has a cost price configured under Inventory Settings, so a value breakdown can't be shown."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.valueByWarehouse}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis
                        fontSize={11}
                        tickFormatter={(v: number) =>
                          formatCurrency(v, "INR", 0)
                        }
                        width={80}
                      />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar
                        dataKey="value"
                        fill={colorFor(0)}
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
                  Stock by Category (Units on Hand)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.stockByCategory.length === 0 ? (
                  <ReportEmptyState title="No stock data." />
                ) : (
                  <DonutChart
                    data={report.stockByCategory}
                    valueFormatter={formatNumber}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Stock Movement Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {report.movementTrend.length === 0 ? (
                  <ReportEmptyState title="No stock ledger movement in the selected range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.movementTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Legend />
                      {MOVEMENT_KEYS.map((k, i) => (
                        <Line
                          key={k}
                          type="monotone"
                          dataKey={k}
                          stroke={colorFor(i)}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Reserved vs Available
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <DonutChart
                  data={report.reservationVsAvailable}
                  valueFormatter={formatNumber}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top Stocked Products
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.topStockedProducts.length === 0 ? (
                  <ReportEmptyState title="No stock data." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.topStockedProducts}
                      layout="vertical"
                      margin={{ left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="productName"
                        fontSize={11}
                        width={140}
                      />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar
                        dataKey="onHand"
                        fill={colorFor(4)}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Reorder Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lowStockItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No items are currently low or out of stock.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.lowStockItems.map((r) => (
                        <TableRow key={`${r.productCode}__${r.warehouseId}`}>
                          <TableCell className="font-mono text-xs">
                            {r.productCode}
                          </TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell>{r.warehouseName}</TableCell>
                          <TableCell className="font-medium">
                            {r.available}
                          </TableCell>
                          <TableCell>{r.reorderLevel ?? "—"}</TableCell>
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
