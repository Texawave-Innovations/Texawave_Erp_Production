// Phase 11 — Inventory Intelligence: stock health, valuation and fast/slow/dead-stock movement
// analysis, built entirely on top of Phase 3/10's existing stock balance, settings and ledger
// data. Reuses `computeInventoryReport` (Phase 10) for every KPI/chart it already exposes.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
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
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";
import { useScmReportsData } from "../reports/reportService";
import { formatCurrency } from "../shared/format";
import { formatNumber, colorFor } from "../reports/reportHelpers";
import {
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "../reports/reportComponents";
import { computeInventoryIntelligence } from "./inventoryIntelligenceService";
import { OVERSTOCK_MULTIPLE } from "../shared/businessRules";

const PRODUCT_TABLE_LIMIT = 25;

export default function ScmInventoryIntelligence() {
  const navigate = useNavigate();
  const { loading, error, data, reload } = useScmReportsData();
  const intelligence = useMemo(
    () => computeInventoryIntelligence(data),
    [data],
  );
  const { report, overstockItems, warehouseHealth, movement } = intelligence;
  const hasData = report.kpis.totalSkuCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Gauge className="h-6 w-6 text-brand-600" /> Inventory Intelligence
        </h2>
        <p className="text-muted-foreground mt-1">
          Stock health, valuation and movement analysis derived from real stock
          balances and ledger history — no fabricated figures.
        </p>
      </div>

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState
          title="No inventory data yet."
          subtitle="Post an opening balance under Inventory → Stock Overview to get started."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  ? "Unavailable"
                  : formatCurrency(report.kpis.inventoryValue)
              }
              unavailable={report.kpis.inventoryValue == null}
              hint={
                report.kpis.inventoryValue == null
                  ? "Set cost price under Inventory Settings"
                  : `Costed for ${report.kpis.valuedSkuCount} of ${report.kpis.totalSkuCount} rows`
              }
            />
            <KpiCard
              label="Reserved vs Available"
              value={`${formatNumber(report.kpis.reserved)} / ${formatNumber(report.kpis.available)}`}
              loading={loading}
              hint="Reserved / Available"
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
            <KpiCard
              label="Overstock Items"
              value={formatNumber(overstockItems.length)}
              loading={loading}
              hint={`Available > ${OVERSTOCK_MULTIPLE}x reorder level`}
            />
            <KpiCard
              label="Incoming Stock"
              value={formatNumber(report.kpis.incoming)}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock by Category</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.stockByCategory.length === 0 ? (
                  <ReportEmptyState title="No category data." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.stockByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {report.stockByCategory.map((_, i) => (
                          <Cell key={i} fill={colorFor(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

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
                    subtitle="No SKU has a cost price configured under Inventory Settings."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.valueByWarehouse}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {report.valueByWarehouse.map((_, i) => (
                          <Cell key={i} fill={colorFor(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Warehouse-wise Stock Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>SKUs</TableHead>
                      <TableHead>Healthy</TableHead>
                      <TableHead>Low Stock</TableHead>
                      <TableHead>Out of Stock</TableHead>
                      <TableHead>Overstock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouseHealth.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <ReportEmptyState title="No warehouse stock data." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      warehouseHealth.map((w) => (
                        <TableRow
                          key={w.warehouseId}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate("/scm/inventory/overview")}
                        >
                          <TableCell className="font-medium">
                            {w.warehouseName}
                          </TableCell>
                          <TableCell>{formatNumber(w.totalSkus)}</TableCell>
                          <TableCell className="text-emerald-600">
                            {formatNumber(w.healthy)}
                          </TableCell>
                          <TableCell className="text-amber-600">
                            {formatNumber(w.lowStock)}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {formatNumber(w.outOfStock)}
                          </TableCell>
                          <TableCell className="text-purple-600">
                            {formatNumber(w.overstock)}
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
              <CardTitle className="text-base">
                Fast-Moving, Slow-Moving &amp; Dead Stock
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Based on actual {movement.lookbackDays}-day sales-issue ledger
                history. A product/warehouse only appears once its ledger
                history spans the full window — otherwise it's left out rather
                than mislabeled.
              </p>
            </CardHeader>
            <CardContent>
              {movement.insufficientData ? (
                <ReportEmptyState
                  title="Insufficient historical data."
                  subtitle={`Movement classification needs at least ${movement.lookbackDays} days of stock ledger history.`}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MovementList
                    title="Fast-Moving"
                    tone="text-emerald-600"
                    items={movement.fastMoving}
                  />
                  <MovementList
                    title="Slow-Moving"
                    tone="text-amber-600"
                    items={movement.slowMoving}
                  />
                  <MovementList
                    title="Dead Stock"
                    tone="text-red-600"
                    items={movement.deadStock}
                    emptyLabel="No dead stock detected."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Low Stock Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ProductRowTable
                  rows={report.lowStockItems}
                  emptyLabel="No low-stock items."
                  onRowClick={(r) =>
                    navigate(
                      `/scm/inventory/overview/${encodeURIComponent(r.productCode)}`,
                    )
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overstock Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ProductRowTable
                  rows={overstockItems}
                  emptyLabel="No overstock items detected."
                  onRowClick={(r) =>
                    navigate(
                      `/scm/inventory/overview/${encodeURIComponent(r.productCode)}`,
                    )
                  }
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MovementList({
  title,
  tone,
  items,
  emptyLabel,
}: {
  title: string;
  tone: string;
  items: Array<{
    productCode: string;
    productName: string;
    warehouseName: string;
    outboundQty: number;
  }>;
  emptyLabel?: string;
}) {
  return (
    <div>
      <div className={`text-sm font-semibold mb-2 ${tone}`}>{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {emptyLabel || "No data."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div
              key={`${i.productCode}__${i.warehouseName}`}
              className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0"
            >
              <span className="truncate">{i.productName}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {formatNumber(i.outboundQty)} units
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductRow {
  productCode: string;
  productName: string;
  warehouseName: string;
  available: number;
  reorderLevel?: number;
}

function ProductRowTable({
  rows,
  emptyLabel,
  onRowClick,
}: {
  rows: ProductRow[];
  emptyLabel: string;
  onRowClick: (r: ProductRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Reorder Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="p-0">
                <ReportEmptyState title={emptyLabel} />
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, PRODUCT_TABLE_LIMIT).map((r) => (
              <TableRow
                key={`${r.productCode}__${r.warehouseName}`}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onRowClick(r)}
              >
                <TableCell className="font-medium">{r.productName}</TableCell>
                <TableCell>{r.warehouseName}</TableCell>
                <TableCell>{formatNumber(r.available)}</TableCell>
                <TableCell>
                  {r.reorderLevel != null ? (
                    formatNumber(r.reorderLevel)
                  ) : (
                    <Badge variant="outline">N/A</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
