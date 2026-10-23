import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "./inventoryPaths";
import { getLedgerEntries } from "./stockLedgerService";
import type {
  StockLedgerEntry,
  StockLedgerTransactionType,
  Warehouse,
} from "@/types";
import {
  ALL,
  errorMessage,
  formatStatusLabel,
} from "@/modules/scm/shared/format";

const PAGE_SIZE = 20;

const TYPE_TONE: Record<StockLedgerTransactionType, string> = {
  OPENING_BALANCE: "text-slate-600 border-slate-200 bg-slate-50",
  PURCHASE_RECEIPT: "text-emerald-600 border-emerald-200 bg-emerald-50",
  SALES_ISSUE: "text-red-600 border-red-200 bg-red-50",
  SALES_RETURN: "text-emerald-600 border-emerald-200 bg-emerald-50",
  PURCHASE_RETURN: "text-red-600 border-red-200 bg-red-50",
  TRANSFER_OUT: "text-amber-600 border-amber-200 bg-amber-50",
  TRANSFER_IN: "text-sky-600 border-sky-200 bg-sky-50",
  ADJUSTMENT_IN: "text-emerald-600 border-emerald-200 bg-emerald-50",
  ADJUSTMENT_OUT: "text-red-600 border-red-200 bg-red-50",
  DAMAGE: "text-red-700 border-red-200 bg-red-50",
  QUARANTINE: "text-purple-600 border-purple-200 bg-purple-50",
  QC_RELEASE: "text-emerald-600 border-emerald-200 bg-emerald-50",
  QC_REJECT: "text-red-700 border-red-200 bg-red-50",
};

/** Where each ledger referenceType's source document lives. Detail routes receive the document id
 * (the part of referenceId before any `:line` suffix). */
const REFERENCE_ROUTES: Record<string, (docId: string) => string> = {
  OPENING_BALANCE: () => "/scm/inventory/overview",
  ADJUSTMENT: () => "/scm/inventory/adjustments",
  TRANSFER: () => "/scm/inventory/transfers",
  GRN: () => "/scm/procurement/grn",
  fulfillment: (id) =>
    id ? `/scm/orders/fulfillment/${id}` : "/scm/orders/fulfillment",
  CUSTOMER_RETURN: (id) =>
    id ? `/scm/returns/${id}` : "/scm/returns/customer",
  VENDOR_RETURN: (id) => (id ? `/scm/returns/${id}` : "/scm/returns/vendor"),
  QC_INSPECTION: (id) =>
    id ? `/scm/quality/inspections/${id}` : "/scm/quality/inspections",
  QC_QUARANTINE_RELEASE: () => "/scm/quality/quarantine",
  QC_QUARANTINE_REJECT: () => "/scm/quality/quarantine",
};

export default function ScmStockLedgerPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const [l, w] = await Promise.all([
        getLedgerEntries(),
        getAllRecords(INVENTORY_PATHS.warehouses) as Promise<Warehouse[]>,
      ]);
      setEntries(l);
      setWarehouses(w);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load the stock ledger"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (
        q &&
        !e.productName.toLowerCase().includes(q) &&
        !e.productCode.toLowerCase().includes(q)
      )
        return false;
      if (warehouseFilter !== ALL && e.warehouseId !== warehouseFilter)
        return false;
      if (typeFilter !== ALL && e.transactionType !== typeFilter) return false;
      return true;
    });
  }, [entries, search, warehouseFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allTypes = Array.from(
    new Set(entries.map((e) => e.transactionType)),
  ) as StockLedgerTransactionType[];

  const goToReference = (entry: StockLedgerEntry) => {
    const route =
      REFERENCE_ROUTES[entry.referenceType] ||
      REFERENCE_ROUTES[entry.transactionType];
    if (route) navigate(route((entry.referenceId || "").split(":")[0]));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Stock Ledger</h2>
        <p className="text-muted-foreground mt-1">
          Authoritative, append-only history of every stock movement. This is
          the source of truth for on-hand quantity.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Input
              placeholder="Search by product name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="md:max-w-sm"
            />
            <div className="flex gap-2">
              <Select
                value={warehouseFilter}
                onValueChange={(v) => {
                  setWarehouseFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Warehouses</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Types</SelectItem>
                  {allTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatStatusLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {entries.length} ledger entries
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>IN</TableHead>
                  <TableHead>OUT</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading ledger...
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <ScrollText className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No inventory transactions yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(e.transactionDate).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-primary hover:underline text-sm"
                          onClick={() => goToReference(e)}
                        >
                          {e.referenceNumber || e.referenceType}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{e.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {e.productCode}
                        </div>
                      </TableCell>
                      <TableCell>{warehouseName(e.warehouseId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={TYPE_TONE[e.transactionType] || ""}
                        >
                          {formatStatusLabel(e.transactionType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-emerald-600 font-medium">
                        {e.quantityIn > 0 ? `+${e.quantityIn}` : ""}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {e.quantityOut > 0 ? `-${e.quantityOut}` : ""}
                      </TableCell>
                      <TableCell>
                        {e.unitCost != null
                          ? e.unitCost.toLocaleString("en-IN")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.createdBy}
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
    </div>
  );
}
