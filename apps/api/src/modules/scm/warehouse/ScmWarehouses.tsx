import { useEffect, useMemo, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Pencil,
  Power,
  Warehouse as WarehouseIcon,
  ScanLine,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getAllRecords, updateRecord } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { useAuth } from "@/context/AuthContext";
import type { ScmPurchaseOrder, Warehouse } from "@/types";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import ScmWarehouseFormDialog from "./ScmWarehouseFormDialog";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";

export default function ScmWarehouses() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrFor, setQrFor] = useState<Warehouse | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = (await getAllRecords(
        INVENTORY_PATHS.warehouses,
      )) as Warehouse[];
      setWarehouses(
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
    } catch {
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter(
      (w) =>
        w.code?.toLowerCase().includes(q) ||
        w.name?.toLowerCase().includes(q) ||
        w.city?.toLowerCase().includes(q),
    );
  }, [warehouses, search]);

  const toggleActive = async (wh: Warehouse) => {
    const next = wh.status === "Active" ? "Inactive" : "Active";
    if (next === "Inactive") {
      try {
        const pos = (await getAllRecords(
          PROCUREMENT_PATHS.purchaseOrders,
        )) as ScmPurchaseOrder[];
        const hasOpenPo = pos.some(
          (p) =>
            p.warehouseId === wh.id &&
            ["SENT", "APPROVED", "PARTIALLY_RECEIVED"].includes(p.status),
        );
        if (hasOpenPo) {
          toast.error(
            "Cannot deactivate — this warehouse has open purchase orders awaiting receipt",
          );
          return;
        }
      } catch {
        // If the check fails we still allow deactivation rather than blocking on a transient read error.
      }
    }
    try {
      await updateRecord(INVENTORY_PATHS.warehouses, wh.id, { status: next });
      await logRecordAudit(
        INVENTORY_PATHS.warehouses,
        wh.id,
        "Warehouse status changed",
        actorName(user),
        `${wh.status} → ${next}`,
      );
      toast.success(`Warehouse marked ${next}`);
      load();
    } catch {
      toast.error("Failed to update warehouse status");
    }
  };

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const match = warehouses.find(
      (w) => w.code?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!match) {
      toast.error(`No warehouse found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "LOCATION",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "WAREHOUSE",
      label: match.name,
      source: "LOCATION",
    });
    setSearch(match.code);
    toast.success(`Found: ${match.name}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Warehouses</h2>
          <p className="text-muted-foreground mt-1">
            Warehouse master — the destination every stock ledger entry,
            reservation and transfer refers to.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Warehouse
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Warehouse
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {warehouses.length} warehouses
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading warehouses...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-16 text-muted-foreground"
                    >
                      {warehouses.length === 0 ? (
                        <div className="flex flex-col items-center gap-3">
                          <WarehouseIcon className="h-10 w-10 text-muted-foreground/40" />
                          <div className="text-lg font-medium text-foreground">
                            No warehouses yet
                          </div>
                          <p className="text-sm">
                            Add your first warehouse before posting any opening
                            balance.
                          </p>
                          <Button
                            onClick={() => {
                              setEditing(null);
                              setFormOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Add your first
                            warehouse
                          </Button>
                        </div>
                      ) : (
                        "No warehouses match the current search."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((wh) => (
                    <TableRow
                      key={wh.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {wh.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{wh.name}</TableCell>
                      <TableCell>{wh.type}</TableCell>
                      <TableCell>{wh.city || "—"}</TableCell>
                      <TableCell>{wh.state || "—"}</TableCell>
                      <TableCell>{wh.managerName || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            wh.status === "Active"
                              ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                              : "text-muted-foreground"
                          }
                        >
                          {wh.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => {
                              setEditing(wh);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={
                              wh.status === "Active" ? "Deactivate" : "Activate"
                            }
                            onClick={() => toggleActive(wh)}
                          >
                            <Power
                              className={`h-4 w-4 ${wh.status === "Active" ? "text-emerald-600" : "text-muted-foreground"}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="QR Label"
                            onClick={() => setQrFor(wh)}
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ScmWarehouseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={editing}
        onSaved={load}
      />

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan Warehouse"
        placeholder="Warehouse code"
      />

      <Dialog
        open={!!qrFor}
        onOpenChange={(o) => {
          if (!o) setQrFor(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Warehouse QR Code</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload("WAREHOUSE", qrFor.code, qrFor.id)}
              title={qrFor.name}
              subtitle={qrFor.code}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
