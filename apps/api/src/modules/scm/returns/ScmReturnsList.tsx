import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Eye, Undo2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import {
  ALL,
  RETURN_STATUS_TONE,
  CUSTOMER_RETURN_STATUSES,
  VENDOR_RETURN_STATUSES,
} from "./returnHelpers";
import { useReturnsData } from "./returnsData";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";

const STATUS_OPTIONS = Array.from(
  new Set([...CUSTOMER_RETURN_STATUSES, ...VENDOR_RETURN_STATUSES]),
);

const PAGE_SIZE = 25;

export default function ScmReturnsList() {
  const navigate = useNavigate();
  const { loading, error, returns, warehouses } = useReturnsData();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [warehouseFilter, setWarehouseFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (typeFilter !== ALL && r.returnType !== typeFilter) return false;
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (warehouseFilter !== ALL && r.warehouseId !== warehouseFilter)
        return false;
      if (!q) return true;
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        (r.salesOrderNumberSnapshot || "").toLowerCase().includes(q) ||
        (r.purchaseOrderNumberSnapshot || "").toLowerCase().includes(q) ||
        (r.customerNameSnapshot || "").toLowerCase().includes(q) ||
        (r.vendorNameSnapshot || "").toLowerCase().includes(q)
      );
    });
  }, [returns, search, typeFilter, statusFilter, warehouseFilter]);

  const paged = filtered.slice(0, page * PAGE_SIZE);
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = returns.find(
      (r) => r.returnNumber.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No return found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "RETURN",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "RETURN",
      label: match.returnNumber,
      viewPath: `/scm/returns/${match.id}`,
      source: "RETURN",
    });
    navigate(`/scm/returns/${match.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">All Returns</h2>
          <p className="text-muted-foreground mt-1">
            Every customer and vendor return, across the full lifecycle.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setScanOpen(true)}
        >
          <ScanLine className="h-4 w-4 mr-2" /> Scan Return
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <Input
            placeholder="Search return #, order #, customer, vendor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="sm:w-72"
          />
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Types</SelectItem>
              <SelectItem value="CUSTOMER_RETURN">Customer Return</SelectItem>
              <SelectItem value="VENDOR_RETURN">Vendor Return</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <div className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {returns.length} returns
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source Document</TableHead>
                  <TableHead>Customer/Vendor</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Requested Qty</TableHead>
                  <TableHead>Received/Returned Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading returns...
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Undo2 className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No returns found
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => {
                    const requestedQty = r.items.reduce(
                      (s, i) => s + i.requestedQuantity,
                      0,
                    );
                    const movedQty = r.items.reduce(
                      (s, i) => s + (i.receivedReturnQuantity || 0),
                      0,
                    );
                    return (
                      <TableRow
                        key={r.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/scm/returns/${r.id}`)}
                      >
                        <TableCell className="font-mono text-xs">
                          {r.returnNumber}
                        </TableCell>
                        <TableCell>
                          {r.returnType === "CUSTOMER_RETURN"
                            ? "Customer"
                            : "Vendor"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.returnType === "CUSTOMER_RETURN"
                            ? r.salesOrderNumberSnapshot || "—"
                            : r.purchaseOrderNumberSnapshot ||
                              r.grnNumberSnapshot ||
                              "—"}
                        </TableCell>
                        <TableCell>
                          {r.returnType === "CUSTOMER_RETURN"
                            ? r.customerNameSnapshot
                            : r.vendorNameSnapshot}
                        </TableCell>
                        <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                        <TableCell>{requestedQty}</TableCell>
                        <TableCell>{movedQty || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={RETURN_STATUS_TONE[r.status]}
                          >
                            {formatStatusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(r.requestedDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/scm/returns/${r.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > paged.length && (
            <div className="p-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
              >
                Load more ({filtered.length - paged.length} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Return"
        placeholder="Return number"
      />
    </div>
  );
}
