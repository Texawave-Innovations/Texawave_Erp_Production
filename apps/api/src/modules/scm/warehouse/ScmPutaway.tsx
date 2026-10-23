import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, PackagePlus, Check, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import {
  ALL,
  PUTAWAY_STATUS_TONE,
  capacityError,
  computeLocationStock,
  locationLabel as formatLocation,
  relocateTrackedStock,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { notifyAdminFeed } from "@/services/notifications";
import type {
  GoodsReceipt,
  PutawayItem,
  PutawayStatus,
  WarehousePutaway,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

const STATUSES: PutawayStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

interface DraftRow {
  productCode: string;
  productName: string;
  batchNumber?: string;
  serialNumbers?: string[];
  remaining: number;
  quantity: string;
  destinationLocationId: string;
}

export default function ScmPutaway() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    warehouses,
    locations,
    loading: mastersLoading,
    error: mastersError,
  } = useWarehouseMasters();
  const {
    loading: opsLoading,
    error,
    putaways,
    movements,
    pickings,
    reload: reloadOps,
  } = useWarehouseOperations();

  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [grnsLoading, setGrnsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const loading = opsLoading || grnsLoading;
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState("");
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [viewPutaway, setViewPutaway] = useState<WarehousePutaway | null>(null);

  const loadGrns = useCallback(async () => {
    setGrnsLoading(true);
    try {
      setGrns((await getAllRecords(PROCUREMENT_PATHS.grns)) as GoodsReceipt[]);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load goods receipts"));
    } finally {
      setGrnsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrns();
  }, [loadGrns]);
  const load = () => {
    reloadOps();
    loadGrns();
  };

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? putaways
        : putaways.filter((p) => p.status === statusFilter),
    [putaways, statusFilter],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;
  const locationLabel = (id?: string) =>
    formatLocation(locations.find((x) => x.id === id));

  /** GRNs with at least one accepted item that hasn't been fully assigned to a location by an
   * existing (non-cancelled) putaway yet — pending or completed putaways both count against the
   * remaining balance so the same received unit can never be double put-away. */
  const eligibleGrns = useMemo(() => {
    return grns.filter((g) => {
      const already = putaways.filter(
        (p) => p.grnId === g.id && p.status !== "CANCELLED",
      );
      return g.items.some((it) => {
        const assigned = already
          .flatMap((p) => p.items)
          .filter((pi) => pi.productCode === it.productCode)
          .reduce((s, pi) => s + pi.quantity, 0);
        return it.acceptedQuantity - assigned > 0;
      });
    });
  }, [grns, putaways]);

  const openCreate = () => {
    setSelectedGrnId("");
    setDraftRows([]);
    setFormOpen(true);
  };

  const buildDraftRows = (grn: GoodsReceipt): DraftRow[] => {
    const already = putaways.filter(
      (p) => p.grnId === grn.id && p.status !== "CANCELLED",
    );
    return grn.items
      .map((it) => {
        const assigned = already
          .flatMap((p) => p.items)
          .filter((pi) => pi.productCode === it.productCode)
          .reduce((s, pi) => s + pi.quantity, 0);
        const remaining = it.acceptedQuantity - assigned;
        return {
          productCode: it.productCode,
          productName: it.productName,
          batchNumber: it.batchNumber,
          serialNumbers: it.serialNumbers,
          remaining,
          quantity: remaining > 0 ? String(remaining) : "0",
          destinationLocationId: "",
        };
      })
      .filter((r) => r.remaining > 0);
  };

  const onSelectGrn = (id: string) => {
    setSelectedGrnId(id);
    const grn = grns.find((g) => g.id === id);
    setDraftRows(grn ? buildDraftRows(grn) : []);
  };

  const selectedGrn = grns.find((g) => g.id === selectedGrnId) || null;
  const binLocationsForGrn = useMemo(() => {
    if (!selectedGrn) return [];
    return locations.filter(
      (l) =>
        l.warehouseId === selectedGrn.warehouseId &&
        l.status === "Active" &&
        (l.locationType || "BIN") === "BIN",
    );
  }, [locations, selectedGrn]);

  const handleSubmit = async () => {
    if (!selectedGrn) {
      toast.error("Select a GRN to put away");
      return;
    }
    const rows = draftRows.filter((r) => Number(r.quantity) > 0);
    if (rows.length === 0) {
      toast.error("Enter a quantity for at least one item");
      return;
    }

    for (const r of rows) {
      const qty = Number(r.quantity);
      if (qty <= 0) {
        toast.error(`${r.productName}: quantity must be greater than zero`);
        return;
      }
      if (qty > r.remaining) {
        toast.error(
          `${r.productName}: cannot put away ${qty}, only ${r.remaining} remaining`,
        );
        return;
      }
      if (!r.destinationLocationId) {
        toast.error(`${r.productName}: select a destination bin`);
        return;
      }
    }

    setSaving(true);
    try {
      const putawayNumber = await reserveDocumentNumber("putaway");
      const items: PutawayItem[] = rows.map((r) => ({
        productCode: r.productCode,
        productName: r.productName,
        batchNumber: r.batchNumber,
        serialNumbers: r.serialNumbers,
        quantity: Number(r.quantity),
        destinationLocationId: r.destinationLocationId,
      }));
      const id = await createRecord(WAREHOUSE_PATHS.putaways, {
        putawayNumber,
        grnId: selectedGrn.id,
        grnNumber: selectedGrn.grnNumber,
        warehouseId: selectedGrn.warehouseId,
        items,
        status: "PENDING" as PutawayStatus,
        assignedBy: performedBy,
        createdBy: performedBy,
        createdAt: Date.now(),
      });
      if (id) {
        await logRecordAudit(
          WAREHOUSE_PATHS.putaways,
          id,
          "Putaway created",
          performedBy,
          `${putawayNumber} against ${selectedGrn.grnNumber}`,
        );
        await notifyAdminFeed(
          "Putaway Pending",
          `${putawayNumber} raised against ${selectedGrn.grnNumber} — ${items.length} item(s) awaiting putaway.`,
          "inventory",
        );
      }
      toast.success("Putaway created — pending completion");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create putaway"));
    } finally {
      setSaving(false);
    }
  };

  const complete = async (putaway: WarehousePutaway) => {
    if (putaway.status !== "PENDING" && putaway.status !== "IN_PROGRESS")
      return; // idempotency guard
    setBusyId(putaway.id);
    try {
      // Capacity re-check at completion time against the bin's total occupancy (every product),
      // counting earlier lines of this same putaway that land in the same bin.
      const stockMap = computeLocationStock(putaways, movements, pickings);
      const addedByBin = new Map<string, number>();
      for (const item of putaway.items) {
        const loc = locations.find((l) => l.id === item.destinationLocationId);
        const pending =
          (addedByBin.get(item.destinationLocationId) || 0) + item.quantity;
        const capErr = capacityError(loc, stockMap, pending);
        if (capErr) throw new Error(capErr);
        addedByBin.set(item.destinationLocationId, pending);
      }

      await transitionStatus<PutawayStatus>(
        WAREHOUSE_PATHS.putaways,
        putaway.id,
        ["PENDING", "IN_PROGRESS"],
        "COMPLETED",
        { completedBy: performedBy, completedAt: Date.now() },
      );

      // Carry batch/serial location along — on-hand was already posted by the GRN's
      // PURCHASE_RECEIPT; putaway only records where that stock physically sits.
      const notes: string[] = [];
      for (const item of putaway.items) {
        notes.push(
          ...(await relocateTrackedStock({
            productCode: item.productCode,
            warehouseId: putaway.warehouseId,
            quantity: item.quantity,
            toLocationId: item.destinationLocationId,
            batchNumber: item.batchNumber,
            serialNumbers: item.serialNumbers,
          })),
        );
      }

      await logRecordAudit(
        WAREHOUSE_PATHS.putaways,
        putaway.id,
        "Putaway completed",
        performedBy,
        [putaway.putawayNumber, ...notes].join(" "),
      );
      await notifyAdminFeed(
        "Putaway Completed",
        `${putaway.putawayNumber} completed — stock assigned to bin location(s).`,
        "inventory",
      );
      if (notes.length) toast.warning(notes.join(" "));
      toast.success("Putaway completed");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to complete putaway"));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (putaway: WarehousePutaway) => {
    if (putaway.status !== "PENDING" && putaway.status !== "IN_PROGRESS")
      return;
    setBusyId(putaway.id);
    try {
      await transitionStatus<PutawayStatus>(
        WAREHOUSE_PATHS.putaways,
        putaway.id,
        ["PENDING", "IN_PROGRESS"],
        "CANCELLED",
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.putaways,
        putaway.id,
        "Putaway cancelled",
        performedBy,
        putaway.putawayNumber,
      );
      toast.success("Putaway cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel putaway"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Put-away</h2>
          <p className="text-muted-foreground mt-1">
            Assign received stock from a GRN to a bin location. This records
            where stock physically sits — the GRN already posted the
            PURCHASE_RECEIPT that raised on-hand.
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={mastersLoading || eligibleGrns.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Create Put-away
        </Button>
      </div>
      {(error || mastersError) && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error || mastersError}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {putaways.length} put-aways
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Put-away #</TableHead>
                  <TableHead>GRN</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading put-aways...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackagePlus className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No put-aways yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {p.putawayNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.grnNumber}
                      </TableCell>
                      <TableCell>{warehouseName(p.warehouseId)}</TableCell>
                      <TableCell>{p.items.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PUTAWAY_STATUS_TONE[p.status]}
                        >
                          {formatStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={() => setViewPutaway(p)}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          {(p.status === "PENDING" ||
                            p.status === "IN_PROGRESS") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Complete"
                                disabled={busyId === p.id}
                                onClick={() => complete(p)}
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancel"
                                disabled={busyId === p.id}
                                onClick={() => cancel(p)}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Put-away</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Goods Receipt *</Label>
              <Select value={selectedGrnId} onValueChange={onSelectGrn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select GRN" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleGrns.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grnNumber} — {g.vendorNameSnapshot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedGrn && (
              <div className="text-sm text-muted-foreground">
                Warehouse: {warehouseName(selectedGrn.warehouseId)}
              </div>
            )}
            {selectedGrn && binLocationsForGrn.length === 0 && (
              <div className="text-sm text-amber-600">
                No bin locations exist in this warehouse yet — create one under
                Warehouse → Locations first.
              </div>
            )}
            <div className="space-y-2">
              {draftRows.map((r, idx) => (
                <div
                  key={`${r.productCode}-${idx}`}
                  className="border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {r.productName}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        ({r.productCode})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Remaining {r.remaining}
                      {r.batchNumber ? ` · Batch ${r.batchNumber}` : ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        max={r.remaining}
                        value={r.quantity}
                        onChange={(e) =>
                          setDraftRows((arr) =>
                            arr.map((x, i) =>
                              i === idx
                                ? { ...x, quantity: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Destination Bin *</Label>
                      <Select
                        value={r.destinationLocationId}
                        onValueChange={(v) =>
                          setDraftRows((arr) =>
                            arr.map((x, i) =>
                              i === idx
                                ? { ...x, destinationLocationId: v }
                                : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select bin" />
                        </SelectTrigger>
                        <SelectContent>
                          {binLocationsForGrn.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {formatLocation(l)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              {selectedGrn && draftRows.length === 0 && (
                <div className="text-sm text-muted-foreground italic">
                  Every accepted item on this GRN has already been put away.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || draftRows.length === 0}
            >
              {saving ? "Saving..." : "Create Put-away"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewPutaway}
        onOpenChange={(o) => {
          if (!o) setViewPutaway(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewPutaway?.putawayNumber}</DialogTitle>
          </DialogHeader>
          {viewPutaway && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                GRN {viewPutaway.grnNumber} ·{" "}
                {warehouseName(viewPutaway.warehouseId)}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Destination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPutaway.items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">
                        {it.productName}
                        {it.batchNumber && (
                          <div className="text-xs text-muted-foreground">
                            Batch {it.batchNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{it.quantity}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {locationLabel(it.destinationLocationId)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
