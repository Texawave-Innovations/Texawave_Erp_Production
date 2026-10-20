import { useMemo, useState } from "react";
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
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useScmReportsData } from "./reportService";
import {
  computeSupplierReport,
  EMPTY_FILTERS,
  type ReportFilters,
  type SupplierReportRow,
} from "./calculations";
import { formatCurrency } from "../shared/format";
import { presetRange, formatNumber } from "./reportHelpers";
import {
  ReportFiltersBar,
  ReportErrorState,
  ReportEmptyState,
  KpiCard,
} from "./reportComponents";
import { exportReportCSV } from "./reportExport";

type SortKey = keyof Pick<
  SupplierReportRow,
  | "poCount"
  | "poValue"
  | "receivedQty"
  | "pendingQty"
  | "vendorReturnCount"
  | "qcFailureCount"
>;
const PAGE_SIZE = 20;

const VENDOR_STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Pending Approval",
  "Blocked",
].map((v) => ({ value: v, label: v }));

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
      <span className="inline-flex items-center gap-1 justify-center w-full">
        {label} <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </TableHead>
  );
}

export default function ScmSupplierReport() {
  const { loading, error, data, reload } = useScmReportsData();
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("poValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const vendorOptions = useMemo(
    () => data.vendors.map((v) => ({ value: v.id, label: v.companyName })),
    [data.vendors],
  );
  const report = useMemo(
    () => computeSupplierReport(data, range, filters),
    [data, range, filters],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? report.rows.filter((r) => r.vendorName.toLowerCase().includes(q))
      : report.rows;
    return [...rows].sort((a, b) =>
      sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey],
    );
  }, [report.rows, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Supplier Report</h2>
        <p className="text-muted-foreground mt-1">
          Supplier spend, receipts, returns and QC outcomes — descriptive only,
          no scoring.
        </p>
      </div>

      <ReportFiltersBar
        range={range}
        onRangeChange={setRange}
        filters={filters}
        onFiltersChange={setFilters}
        vendors={vendorOptions}
        statuses={VENDOR_STATUS_OPTIONS}
        onExport={() =>
          exportReportCSV(
            filteredRows,
            [
              { key: "vendorName", label: "Supplier" },
              { key: "status", label: "Status" },
              { key: "poCount", label: "PO Count" },
              { key: "poValue", label: "PO Value" },
              { key: "receivedQty", label: "Received Qty" },
              { key: "pendingQty", label: "Pending Qty" },
              { key: "vendorReturnCount", label: "Vendor Returns" },
              { key: "qcFailureCount", label: "QC Failures" },
            ],
            "Supplier_Report",
          )
        }
        exportDisabled={filteredRows.length === 0}
        dateFieldNote="Purchase Orders are filtered by PO Date, GRNs by Receipt Date, and Vendor Returns by Requested Date (each falls back to creation date when unset)."
      />

      {error ? (
        <ReportErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Active Suppliers"
              value={formatNumber(report.kpis.activeSupplierCount)}
              loading={loading}
            />
            <KpiCard
              label="Total PO Value (filtered)"
              value={formatCurrency(report.kpis.totalPoValue)}
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">Suppliers</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search supplier..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground pt-1">
                {filteredRows.length} supplier(s)
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <SortHeader
                        label="PO Count"
                        sortKey="poCount"
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="PO Value"
                        sortKey="poValue"
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Received"
                        sortKey="receivedQty"
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Pending"
                        sortKey="pendingQty"
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Vendor Returns"
                        sortKey="vendorReturnCount"
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="QC Failures"
                        sortKey="qcFailureCount"
                        onSort={toggleSort}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-16 text-muted-foreground"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0">
                          <ReportEmptyState title="No supplier activity for the selected filters." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((r) => (
                        <TableRow key={r.vendorId}>
                          <TableCell className="font-medium">
                            {r.vendorName}
                          </TableCell>
                          <TableCell className="text-xs">{r.status}</TableCell>
                          <TableCell>{formatNumber(r.poCount)}</TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(r.poValue)}
                          </TableCell>
                          <TableCell>{formatNumber(r.receivedQty)}</TableCell>
                          <TableCell>{formatNumber(r.pendingQty)}</TableCell>
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
