// Phase 11 — Supplier Performance Intelligence. Builds on the Phase 10 Supplier Report
// (explicitly descriptive-only) and adds one transparent, documented on-time receipt rate —
// no black-box supplier score. See `supplierIntelligenceService.ts` for the exact formula.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Users } from "lucide-react";
import { useScmReportsData } from "../reports/reportService";
import { EMPTY_FILTERS, type ReportFilters } from "../reports/calculations";
import { formatCurrency } from "../shared/format";
import {
  presetRange,
  formatNumber,
  formatPercent,
  formatDays,
} from "../reports/reportHelpers";
import {
  ReportFiltersBar,
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "../reports/reportComponents";
import {
  computeSupplierIntelligence,
  type SupplierIntelligenceRow,
} from "./supplierIntelligenceService";

type SortKey =
  | "poValue"
  | "onTimeRatePercent"
  | "avgFulfillmentDays"
  | "vendorReturnCount"
  | "qcFailureCount";

function SortHeader({
  label,
  sortKey,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => onSort(sortKey)}
    >
      {label}
    </TableHead>
  );
}

export default function ScmSupplierIntelligence() {
  const navigate = useNavigate();
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("90d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("poValue");

  const vendorOptions = useMemo(
    () => data.vendors.map((v) => ({ value: v.id, label: v.companyName })),
    [data.vendors],
  );
  const result = useMemo(
    () => computeSupplierIntelligence(data, range, filters),
    [data, range, filters],
  );

  const rows = useMemo(() => {
    return [...result.rows].sort((a, b) => {
      const av = a[sortKey],
        bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
  }, [result.rows, sortKey]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-brand-600" /> Supplier Performance
          Intelligence
        </h2>
        <p className="text-muted-foreground mt-1">
          On-Time Receipt Rate = on-time GRNs / (on-time + delayed GRNs) for POs
          with both an expected delivery date and a receipt date, shown only
          once at least 3 receipts exist. No composite or black-box supplier
          score is produced.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        vendors={vendorOptions}
        dateFieldNote="Purchase Orders are filtered by PO Date and GRNs by Receipt Date (each falls back to creation date when unset)."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Active Suppliers"
              value={formatNumber(result.kpis.activeSupplierCount)}
              loading={loading}
            />
            <KpiCard
              label="Total PO Value (filtered)"
              value={formatCurrency(result.kpis.totalPoValue)}
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suppliers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <SortHeader
                        label="PO Value"
                        sortKey="poValue"
                        onSort={setSortKey}
                      />
                      <SortHeader
                        label="On-Time Rate"
                        sortKey="onTimeRatePercent"
                        onSort={setSortKey}
                      />
                      <SortHeader
                        label="Avg. Fulfillment (days)"
                        sortKey="avgFulfillmentDays"
                        onSort={setSortKey}
                      />
                      <TableHead>Delayed</TableHead>
                      <TableHead>Partial</TableHead>
                      <SortHeader
                        label="Vendor Returns"
                        sortKey="vendorReturnCount"
                        onSort={setSortKey}
                      />
                      <SortHeader
                        label="QC Failures"
                        sortKey="qcFailureCount"
                        onSort={setSortKey}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-16 text-muted-foreground"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0">
                          <ReportEmptyState title="No supplier activity for the selected filters." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r: SupplierIntelligenceRow) => (
                        <TableRow
                          key={r.vendorId}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() =>
                            navigate(`/scm/suppliers/${r.vendorId}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {r.vendorName}
                          </TableCell>
                          <TableCell className="text-xs">{r.status}</TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(r.poValue)}
                          </TableCell>
                          <TableCell>
                            {r.onTimeRatePercent == null ? (
                              <Badge variant="outline">N/A</Badge>
                            ) : (
                              formatPercent(r.onTimeRatePercent)
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDays(r.avgFulfillmentDays)}
                          </TableCell>
                          <TableCell>
                            {formatNumber(r.delayedReceiptCount)}
                          </TableCell>
                          <TableCell>
                            {formatNumber(r.partialReceiptCount)}
                          </TableCell>
                          <TableCell>
                            {formatNumber(r.vendorReturnCount)}
                          </TableCell>
                          <TableCell>
                            {formatNumber(r.qcFailureCount)}
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
