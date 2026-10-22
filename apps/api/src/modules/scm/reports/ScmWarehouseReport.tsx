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
  computeWarehouseReport,
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
  ReportFiltersBar,
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "./reportComponents";

const LOCATION_ROWS_LIMIT = 25;

export default function ScmWarehouseReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const warehouseOptions = useMemo(
    () => data.warehouses.map((w) => ({ value: w.id, label: w.name })),
    [data.warehouses],
  );
  const report = useMemo(
    () => computeWarehouseReport(data, range, filters),
    [data, range, filters],
  );
  const hasData = report.kpis.warehouseCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Warehouse Report</h2>
        <p className="text-muted-foreground mt-1">
          Warehouse footprint and put-away/movement/pick/pack operations volume.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouseOptions}
        dateFieldNote="Operation volumes (put-away, movement, picking, packing) are filtered by each document's creation date. Warehouse/location counts and stock distribution are current, point-in-time figures."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : !loading && !hasData ? (
        <ReportEmptyState
          title="No warehouses configured yet."
          subtitle="Create a warehouse under Warehouse → Warehouses to get started."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <KpiCard
              label="Warehouses"
              value={formatNumber(report.kpis.warehouseCount)}
              loading={loading}
            />
            <KpiCard
              label="Active Warehouses"
              value={formatNumber(report.kpis.activeWarehouseCount)}
              loading={loading}
            />
            <KpiCard
              label="Locations"
              value={formatNumber(report.kpis.locationCount)}
              loading={loading}
            />
            <KpiCard
              label="Put-aways"
              value={formatNumber(report.kpis.putawayCount)}
              loading={loading}
            />
            <KpiCard
              label="Internal Movements"
              value={formatNumber(report.kpis.movementCount)}
              loading={loading}
            />
            <KpiCard
              label="Picking Operations"
              value={formatNumber(report.kpis.pickingCount)}
              loading={loading}
            />
            <KpiCard
              label="Packing Operations"
              value={formatNumber(report.kpis.packingCount)}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Operations Volume Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.operationsVolume.length === 0 ? (
                  <ReportEmptyState title="No warehouse operations in range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.operationsVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Putaway"
                        stroke={colorFor(0)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Movement"
                        stroke={colorFor(1)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Picking"
                        stroke={colorFor(2)}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Packing"
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
                  Stock Distribution by Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {report.stockByWarehouse.length === 0 ? (
                  <ReportEmptyState title="No stock balances yet." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.stockByWarehouse}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar
                        dataKey="value"
                        name="Units on hand"
                        fill={colorFor(5)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location Utilization</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {report.locationUtilization == null ||
              report.locationUtilization.rated.length === 0 ? (
                <ReportEmptyState
                  title="Location utilization: N/A"
                  subtitle="No location has a configured capacity, so occupancy can't be calculated. Set a capacity under Warehouse → Locations to enable this."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Occupied</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...report.locationUtilization.rated]
                        .sort((a, b) => b.percent - a.percent)
                        .slice(0, LOCATION_ROWS_LIMIT)
                        .map((l) => (
                          <TableRow key={l.key}>
                            <TableCell className="font-mono text-xs">
                              {l.label}
                            </TableCell>
                            <TableCell>{formatNumber(l.occupied)}</TableCell>
                            <TableCell>{formatNumber(l.capacity)}</TableCell>
                            <TableCell className="font-medium">
                              {formatPercent(l.percent)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {report.locationUtilization &&
                report.locationUtilization.unratedCount > 0 && (
                  <p className="text-xs text-muted-foreground px-4 py-3 border-t">
                    {report.locationUtilization.unratedCount} location(s) have
                    no configured capacity and are excluded — shown as N/A
                    rather than an invented percentage.
                  </p>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
