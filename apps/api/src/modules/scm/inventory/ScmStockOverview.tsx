import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
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
import {
  Search,
  Plus,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useInventoryData,
  computeStockStatus,
  type StockStatus,
} from "./useInventoryData";
import OpeningBalanceDialog from "./OpeningBalanceDialog";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { ALL, formatCurrency } from "@/modules/scm/shared/format";
import { stockValue } from "@/modules/scm/shared/businessRules";
import { useScmMasterData } from "../masterData/useScmMasterData";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
const PAGE_SIZE = 20;

const STATUS_TONE: Record<StockStatus, string> = {
  "Out of Stock": "text-red-600 border-red-200 bg-red-50",
  "Low Stock": "text-amber-600 border-amber-200 bg-amber-50",
  Healthy: "text-emerald-600 border-emerald-200 bg-emerald-50",
  Overstock: "text-sky-600 border-sky-200 bg-sky-50",
};

export default function ScmStockOverview() {
  const navigate = useNavigate();
  const { loading, error, products, warehouses, rows, reload } =
    useInventoryData();
  useErrorToast(error);
  const master = useScmMasterData();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const q = scanned.toLowerCase();
    const product = products.find((p) => p.productCode.toLowerCase() === q);
    if (product) {
      addScanHistoryEntry({
        code: scanned,
        type: "PRODUCT",
        label: product.name,
        viewPath: `/scm/inventory/overview/${encodeURIComponent(product.productCode)}`,
        source: "INVENTORY",
      });
      navigate(
        `/scm/inventory/overview/${encodeURIComponent(product.productCode)}`,
      );
      return;
    }
    const batch = master.data.batches.find(
      (b) => b.batchNumber.toLowerCase() === q,
    );
    if (batch) {
      addScanHistoryEntry({
        code: scanned,
        type: "BATCH",
        label: batch.batchNumber,
        viewPath: "/scm/inventory/batches",
        source: "INVENTORY",
      });
      toast.success(
        `Batch ${batch.batchNumber} — ${batch.productName} · Qty ${batch.quantity}`,
      );
      navigate("/scm/inventory/batches");
      return;
    }
    const serial = master.data.serials.find(
      (s) => s.serialNumber.toLowerCase() === q,
    );
    if (serial) {
      addScanHistoryEntry({
        code: scanned,
        type: "SERIAL",
        label: serial.serialNumber,
        viewPath: "/scm/inventory/serials",
        source: "INVENTORY",
      });
      toast.success(
        `Serial ${serial.serialNumber} — ${serial.productName} · ${serial.status}`,
      );
      navigate("/scm/inventory/serials");
      return;
    }
    const loc = master.data.locations.find(
      (l) => (l.locationCode || l.binCode).toLowerCase() === q,
    );
    if (loc) {
      addScanHistoryEntry({
        code: scanned,
        type: "LOCATION",
        label: loc.locationCode || loc.binCode,
        viewPath: "/scm/warehouse/locations",
        source: "INVENTORY",
      });
      toast.success(`Location ${loc.locationCode || loc.binCode} found`);
      navigate("/scm/warehouse/locations");
      return;
    }
    setSearch(scanned);
    toast.error(`No product, batch, serial or location found for "${scanned}"`);
    addScanHistoryEntry({
      code: scanned,
      type: "UNKNOWN",
      label: "Not found",
      source: "INVENTORY",
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        !r.productName.toLowerCase().includes(q) &&
        !r.productCode.toLowerCase().includes(q)
      )
        return false;
      if (warehouseFilter !== ALL && r.warehouseId !== warehouseFilter)
        return false;
      if (statusFilter !== ALL && computeStockStatus(r) !== statusFilter)
        return false;
      return true;
    });
  }, [rows, search, warehouseFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totals = useMemo(() => {
    const totalValue = rows.reduce(
      (sum, r) => sum + stockValue(r.onHand, r.costPrice),
      0,
    );
    const hasCostData = rows.some((r) => r.costPrice != null);
    const totalAvailable = rows.reduce((sum, r) => sum + r.available, 0);
    const totalReserved = rows.reduce((sum, r) => sum + r.reserved, 0);
    const lowStock = rows.filter(
      (r) => computeStockStatus(r) === "Low Stock",
    ).length;
    const outOfStock = rows.filter(
      (r) => computeStockStatus(r) === "Out of Stock" && r.hasLedgerHistory,
    ).length;
    const totalIncoming = rows.reduce((sum, r) => sum + r.incoming, 0);
    return {
      totalValue,
      hasCostData,
      totalAvailable,
      totalReserved,
      totalIncoming,
      lowStock,
      outOfStock,
    };
  }, [rows]);

  const kpis = [
    {
      id: "value",
      label: "Total Inventory Value",
      value: totals.hasCostData
        ? formatCurrency(totals.totalValue, "INR", 0)
        : "Not available yet",
      hint: totals.hasCostData
        ? "On hand × unit cost"
        : "Set cost price in Inventory Settings",
      pending: !totals.hasCostData,
    },
    {
      id: "skus",
      label: "Total SKUs",
      value: String(products.length),
      hint: `${warehouses.length} warehouse(s)`,
    },
    {
      id: "available",
      label: "Available Stock",
      value: String(totals.totalAvailable),
      hint: "On hand − reserved, across all warehouses",
    },
    {
      id: "reserved",
      label: "Reserved Stock",
      value: String(totals.totalReserved),
      hint: "Held against confirmed sales orders",
    },
    {
      id: "low",
      label: "Low Stock Items",
      value: String(totals.lowStock),
      hint: "At or below reorder level",
    },
    {
      id: "out",
      label: "Out of Stock Items",
      value: String(totals.outOfStock),
      hint: "Zero available, has ledger history",
    },
    {
      id: "incoming",
      label: "Incoming Stock",
      value: String(totals.totalIncoming),
      hint: "Open on approved purchase orders",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Stock Overview</h2>
          <p className="text-muted-foreground mt-1">
            On-hand, reserved, available and incoming stock by product and
            warehouse.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Product / Batch / Serial
            / Location
          </Button>
          <Button
            onClick={() => setOpeningOpen(true)}
            disabled={warehouses.length === 0 || products.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" /> Post Opening Balance
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.id} className="overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {kpi.label}
              </p>
              <p
                className={cn(
                  "text-xl font-bold mt-1",
                  kpi.pending
                    ? "text-muted-foreground text-sm"
                    : "text-foreground",
                )}
              >
                {loading && !kpi.pending ? "…" : kpi.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {kpi.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {warehouses.length === 0 && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            No warehouses configured yet. Create one under Warehouse →
            Warehouses before posting stock.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name or SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
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
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Statuses</SelectItem>
                  {(
                    [
                      "Healthy",
                      "Low Stock",
                      "Out of Stock",
                      "Overstock",
                    ] as StockStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {rows.length} stock rows
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Incoming</TableHead>
                  <TableHead>Damaged</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading inventory...
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-16 text-muted-foreground"
                    >
                      {rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-3">
                          <Boxes className="h-10 w-10 text-muted-foreground/40" />
                          <div className="text-lg font-medium text-foreground">
                            No stock balances available.
                          </div>
                          <p className="text-sm">
                            Post an opening balance to bring a product into the
                            stock ledger.
                          </p>
                        </div>
                      ) : (
                        "No stock rows match the current filters."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => {
                    const status = computeStockStatus(r);
                    return (
                      <TableRow
                        key={`${r.productCode}__${r.warehouseId}`}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/scm/inventory/overview/${encodeURIComponent(r.productCode)}`,
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          {r.productName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {r.productCode}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.warehouseName}</TableCell>
                        <TableCell>{r.onHand}</TableCell>
                        <TableCell>{r.reserved}</TableCell>
                        <TableCell className="font-medium">
                          {r.available}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          Pending Procurement
                        </TableCell>
                        <TableCell>{r.damaged}</TableCell>
                        <TableCell>{r.reorderLevel ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_TONE[status]}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

      <OpeningBalanceDialog
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        products={products}
        warehouses={warehouses}
        onPosted={reload}
      />
      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Product / Batch / Serial / Location"
        placeholder="SKU, batch, serial or location code"
      />
    </div>
  );
}
