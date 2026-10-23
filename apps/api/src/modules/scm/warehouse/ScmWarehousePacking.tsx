import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  PackageOpen,
  Check,
  X,
  Eye,
  Trash2,
  ScanLine,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { createRecord, getRecordsWhere } from "@/services/firebase";
import { WAREHOUSE_PATHS } from "./warehousePaths";
import {
  ALL,
  PACK_STATUS_TONE,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import { useAuth } from "@/context/AuthContext";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import { notifyAdminFeed } from "@/services/notifications";
import {
  linkPackingToFulfillment,
  syncFulfillmentProgress,
} from "../orders/orderFulfillmentService";
import { withActionLock } from "@/modules/scm/shared/actionLock";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import type {
  PackStatus,
  WarehousePacking,
  WarehousePackage,
  WarehousePicking,
} from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

const PACKAGE_TYPES = ["Box", "Crate", "Pallet", "Envelope", "Bag"];
const STATUSES: PackStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "PACKED",
  "CANCELLED",
];

function sumByProduct(
  lines: { productCode: string; quantity: number }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lines)
    map.set(
      l.productCode,
      (map.get(l.productCode) || 0) + (Number(l.quantity) || 0),
    );
  return map;
}

const pickedLines = (pick: WarehousePicking) =>
  pick.items.map((it) => ({
    productCode: it.productCode,
    quantity: it.pickedQuantity || 0,
  }));
const packedLines = (packages: WarehousePackage[]) =>
  packages.flatMap((p) => p.items || []);

/** Products whose packed quantity is below the picked quantity. */
function shortPacked(
  pick: WarehousePicking,
  packages: WarehousePackage[],
): string[] {
  const packed = sumByProduct(packedLines(packages));
  return [...sumByProduct(pickedLines(pick))]
    .filter(([code, qty]) => (packed.get(code) || 0) < qty)
    .map(([code]) => code);
}

export default function ScmWarehousePacking() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const {
    warehouses,
    loading: mastersLoading,
    error: mastersError,
  } = useWarehouseMasters();
  const {
    loading,
    error,
    pickings,
    packings,
    reload: load,
  } = useWarehouseOperations();
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPickId, setSelectedPickId] = useState("");
  const [packages, setPackages] = useState<
    (WarehousePackage & { _key: number })[]
  >([]);

  const [viewPack, setViewPack] = useState<WarehousePacking | null>(null);
  const [scanPackageKey, setScanPackageKey] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [qrPackage, setQrPackage] = useState<{
    pkg: WarehousePackage;
    packing: WarehousePacking;
  } | null>(null);

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? packings
        : packings.filter((p) => p.status === statusFilter),
    [packings, statusFilter],
  );
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || id;

  // One packing per pick, and only once picking is complete — a partially picked list is
  // finished (or closed short) in the picking workspace first, so packed ≤ picked stays simple.
  const packedPickIds = useMemo(
    () =>
      new Set(
        packings.filter((p) => p.status !== "CANCELLED").map((p) => p.pickId),
      ),
    [packings],
  );
  const eligiblePicks = useMemo(
    () =>
      pickings.filter(
        (p) =>
          p.status === "COMPLETED" &&
          !p.stockIssuedAt &&
          !packedPickIds.has(p.id),
      ),
    [pickings, packedPickIds],
  );

  const selectedPick = pickings.find((p) => p.id === selectedPickId) || null;

  const openCreate = () => {
    setSelectedPickId("");
    setPackages([]);
    setFormOpen(true);
  };

  const addPackage = () => {
    if (!selectedPick) return;
    setPackages((arr) => [
      ...arr,
      {
        _key: Date.now(),
        packageNumber: `PKG-${arr.length + 1}`,
        packageType: "Box",
        weight: undefined,
        length: undefined,
        width: undefined,
        height: undefined,
        items: selectedPick.items
          .filter((it) => it.pickedQuantity > 0)
          .map((it) => ({
            productCode: it.productCode,
            productName: it.productName,
            quantity: 0,
          })),
      },
    ]);
  };

  const removePackage = (key: number) =>
    setPackages((arr) => arr.filter((p) => p._key !== key));

  const packagedQtyByProduct = useMemo(
    () => sumByProduct(packedLines(packages)),
    [packages],
  );
  const handlePackageScan = (code: string) => {
    if (scanPackageKey == null) return;
    const scanned = code.trim();
    const pkg = packages.find((p) => p._key === scanPackageKey);
    const item = pkg?.items.find(
      (it) => it.productCode.toLowerCase() === scanned.toLowerCase(),
    );
    if (!pkg || !item) {
      toast.error(`Product mismatch — "${scanned}" is not part of this pick`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Product mismatch",
        source: "PACKING",
      });
      return;
    }
    setPackages((arr) =>
      arr.map((p) =>
        p._key === scanPackageKey
          ? {
              ...p,
              items: p.items.map((it) =>
                it.productCode === item.productCode
                  ? { ...it, quantity: (Number(it.quantity) || 0) + 1 }
                  : it,
              ),
            }
          : p,
      ),
    );
    toast.success(`+1 ${item.productName}`);
    addScanHistoryEntry({
      code: scanned,
      type: "PRODUCT",
      label: item.productName,
      source: "PACKING",
    });
  };

  const handleFindScan = (code: string) => {
    const scanned = code.trim();
    const pack = packings.find(
      (p) =>
        p.packNumber.toLowerCase() === scanned.toLowerCase() ||
        p.pickNumber?.toLowerCase() === scanned.toLowerCase() ||
        p.salesOrderNumber?.toLowerCase() === scanned.toLowerCase(),
    );
    if (!pack) {
      toast.error(`No packing found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "PACKING",
      });
      return;
    }
    setViewPack(pack);
    toast.success(`Found ${pack.packNumber}`);
    addScanHistoryEntry({
      code: scanned,
      type: "SALES_ORDER",
      label: pack.packNumber,
      source: "PACKING",
    });
  };

  const handleSubmit = async () => {
    if (!selectedPick) {
      toast.error("Select a completed pick list");
      return;
    }
    if (packages.length === 0) {
      toast.error("Add at least one package");
      return;
    }

    for (const [code, picked] of sumByProduct(pickedLines(selectedPick))) {
      const packed = packagedQtyByProduct.get(code) || 0;
      if (packed > picked) {
        toast.error(
          `${code}: packaged quantity (${packed}) exceeds picked quantity (${picked})`,
        );
        return;
      }
    }
    for (const pkg of packages) {
      if (!pkg.items.some((it) => Number(it.quantity) > 0)) {
        toast.error(`${pkg.packageNumber}: add at least one item quantity`);
        return;
      }
    }

    setSaving(true);
    try {
      await withActionLock(`pack:${selectedPick.id}`, async () => {
        const existing = await getRecordsWhere<WarehousePacking>(
          WAREHOUSE_PATHS.packings,
          "pickId",
          selectedPick.id,
        );
        if (existing.some((p) => p.status !== "CANCELLED"))
          throw new Error(
            "This pick list has already been packed. Refresh the page.",
          );
        const packNumber = await reserveDocumentNumber("pack");
        const cleanPackages: WarehousePackage[] = packages.map(
          ({ _key, ...pkg }) => ({
            ...pkg,
            weight: pkg.weight != null ? Number(pkg.weight) : undefined,
            length: pkg.length != null ? Number(pkg.length) : undefined,
            width: pkg.width != null ? Number(pkg.width) : undefined,
            height: pkg.height != null ? Number(pkg.height) : undefined,
            items: pkg.items
              .filter((it) => Number(it.quantity) > 0)
              .map((it) => ({ ...it, quantity: Number(it.quantity) })),
          }),
        );
        const status: PackStatus =
          shortPacked(selectedPick, cleanPackages).length === 0
            ? "PACKED"
            : "IN_PROGRESS";

        const id = await createRecord(WAREHOUSE_PATHS.packings, {
          packNumber,
          pickId: selectedPick.id,
          pickNumber: selectedPick.pickNumber,
          salesOrderId: selectedPick.salesOrderId,
          salesOrderNumber: selectedPick.salesOrderNumber,
          fulfillmentId: selectedPick.fulfillmentId,
          warehouseId: selectedPick.warehouseId,
          packages: cleanPackages,
          status,
          createdBy: performedBy,
          createdAt: Date.now(),
          completedAt: status === "PACKED" ? Date.now() : undefined,
        });
        if (id) {
          await logRecordAudit(
            WAREHOUSE_PATHS.packings,
            id,
            "Packing created",
            performedBy,
            `${packNumber} for ${selectedPick.pickNumber}`,
          );
          if (status === "PACKED")
            await notifyAdminFeed(
              "Packing Completed",
              `${packNumber} packed for ${selectedPick.salesOrderNumber} — ${cleanPackages.length} package(s).`,
              "inventory",
            );
          if (selectedPick.fulfillmentId)
            await linkPackingToFulfillment(
              selectedPick.fulfillmentId,
              id,
              status === "PACKED",
              performedBy,
            );
        }
        toast.success(
          status === "PACKED" ? "Packing completed" : "Packing saved",
        );
      });
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save packing"));
    } finally {
      setSaving(false);
    }
  };

  const markPacked = async (p: WarehousePacking) => {
    if (p.status !== "PENDING" && p.status !== "IN_PROGRESS") return; // idempotency guard
    const pick = pickings.find((pk) => pk.id === p.pickId);
    const short = pick ? shortPacked(pick, p.packages) : [];
    // Packing short is allowed — the fulfillment then issues only the packed quantity.
    if (
      short.length > 0 &&
      !window.confirm(
        `Packed less than picked for ${short.join(", ")}. Only the packed quantity will be issued. Mark packed anyway?`,
      )
    )
      return;
    setBusyId(p.id);
    try {
      await transitionStatus<PackStatus>(
        WAREHOUSE_PATHS.packings,
        p.id,
        ["PENDING", "IN_PROGRESS"],
        "PACKED",
        { completedAt: Date.now() },
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.packings,
        p.id,
        "Packing completed",
        performedBy,
        short.length
          ? `${p.packNumber} (short: ${short.join(", ")})`
          : p.packNumber,
      );
      await notifyAdminFeed(
        "Packing Completed",
        `${p.packNumber} marked packed for ${p.salesOrderNumber}.`,
        "inventory",
      );
      if (p.fulfillmentId)
        await linkPackingToFulfillment(
          p.fulfillmentId,
          p.id,
          true,
          performedBy,
        );
      toast.success("Packing marked complete");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to update packing"));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (p: WarehousePacking) => {
    if (p.status === "PACKED" || p.status === "CANCELLED") return;
    setBusyId(p.id);
    try {
      await transitionStatus<PackStatus>(
        WAREHOUSE_PATHS.packings,
        p.id,
        ["PENDING", "IN_PROGRESS"],
        "CANCELLED",
      );
      await logRecordAudit(
        WAREHOUSE_PATHS.packings,
        p.id,
        "Packing cancelled",
        performedBy,
        p.packNumber,
      );
      if (p.fulfillmentId) await syncFulfillmentProgress(p.fulfillmentId);
      toast.success("Packing cancelled");
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to cancel packing"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Packing</h2>
          <p className="text-muted-foreground mt-1">
            Pack picked items into shippable packages. Carrier and shipment
            tracking are out of scope here — this only records what went into
            which package.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setFindOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan Order
          </Button>
          <Button
            onClick={openCreate}
            disabled={mastersLoading || eligiblePicks.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Packing
          </Button>
        </div>
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
            {filtered.length} of {packings.length} packings
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pack #</TableHead>
                  <TableHead>Pick #</TableHead>
                  <TableHead>Sales Order</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Packages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading packings...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageOpen className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No packings yet
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
                        {p.packNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.pickNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.salesOrderNumber}
                      </TableCell>
                      <TableCell>{warehouseName(p.warehouseId)}</TableCell>
                      <TableCell>{p.packages.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PACK_STATUS_TONE[p.status]}
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
                            onClick={() => setViewPack(p)}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          {p.status === "IN_PROGRESS" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark Packed"
                              disabled={busyId === p.id}
                              onClick={() => markPacked(p)}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {p.status !== "PACKED" &&
                            p.status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancel"
                                disabled={busyId === p.id}
                                onClick={() => cancel(p)}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
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
            <DialogTitle>Create Packing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Pick List *</Label>
              <Select
                value={selectedPickId}
                onValueChange={(v) => {
                  setSelectedPickId(v);
                  setPackages([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a completed pick list" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePicks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pickNumber} — {p.salesOrderNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPick && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {warehouseName(selectedPick.warehouseId)}
                  </div>
                  <Button variant="outline" size="sm" onClick={addPackage}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Package
                  </Button>
                </div>
                {packages.map((pkg, pIdx) => (
                  <div
                    key={pkg._key}
                    className="border rounded-md p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        className="max-w-[160px] font-mono"
                        value={pkg.packageNumber}
                        onChange={(e) =>
                          setPackages((arr) =>
                            arr.map((p, i) =>
                              i === pIdx
                                ? { ...p, packageNumber: e.target.value }
                                : p,
                            ),
                          )
                        }
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScanPackageKey(pkg._key)}
                        >
                          <ScanLine className="h-3.5 w-3.5 mr-1.5" /> Scan
                          Product
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePackage(pkg._key)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="space-y-1 col-span-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={pkg.packageType}
                          onValueChange={(v) =>
                            setPackages((arr) =>
                              arr.map((p, i) =>
                                i === pIdx ? { ...p, packageType: v } : p,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PACKAGE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Weight (kg)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={pkg.weight ?? ""}
                          onChange={(e) =>
                            setPackages((arr) =>
                              arr.map((p, i) =>
                                i === pIdx
                                  ? {
                                      ...p,
                                      weight:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">L (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={pkg.length ?? ""}
                          onChange={(e) =>
                            setPackages((arr) =>
                              arr.map((p, i) =>
                                i === pIdx
                                  ? {
                                      ...p,
                                      length:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">W (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={pkg.width ?? ""}
                          onChange={(e) =>
                            setPackages((arr) =>
                              arr.map((p, i) =>
                                i === pIdx
                                  ? {
                                      ...p,
                                      width:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">H (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={pkg.height ?? ""}
                          onChange={(e) =>
                            setPackages((arr) =>
                              arr.map((p, i) =>
                                i === pIdx
                                  ? {
                                      ...p,
                                      height:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {pkg.items.map((it, iIdx) => (
                        <div
                          key={`${it.productCode}-${iIdx}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex-1">
                            {it.productName}{" "}
                            <span className="text-xs text-muted-foreground font-mono">
                              ({it.productCode})
                            </span>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            className="w-24"
                            value={it.quantity}
                            onChange={(e) =>
                              setPackages((arr) =>
                                arr.map((p, i) =>
                                  i === pIdx
                                    ? {
                                        ...p,
                                        items: p.items.map((x, i2) =>
                                          i2 === iIdx
                                            ? {
                                                ...x,
                                                quantity:
                                                  Number(e.target.value) || 0,
                                              }
                                            : x,
                                        ),
                                      }
                                    : p,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {packages.length === 0 && (
                  <div className="text-sm text-muted-foreground italic">
                    Add at least one package.
                  </div>
                )}
              </>
            )}
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
              disabled={saving || !selectedPick || packages.length === 0}
            >
              {saving ? "Saving..." : "Save Packing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewPack}
        onOpenChange={(o) => {
          if (!o) setViewPack(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewPack?.packNumber}</DialogTitle>
          </DialogHeader>
          {viewPack && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Pick {viewPack.pickNumber} · SO {viewPack.salesOrderNumber}
              </div>
              {viewPack.packages.map((pkg, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium font-mono text-sm">
                      {pkg.packageNumber}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pkg.packageType})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQrPackage({ pkg, packing: viewPack })}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR
                    </Button>
                  </div>
                  {pkg.items.map((it, i2) => (
                    <div key={i2} className="text-sm flex justify-between">
                      <span>{it.productName}</span>
                      <span>{it.quantity}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanPackageKey != null}
        onOpenChange={(o) => {
          if (!o) setScanPackageKey(null);
        }}
        onResult={(code) => {
          handlePackageScan(code);
          setScanPackageKey(null);
        }}
        title="Scan Product"
        placeholder="Product SKU or barcode"
      />
      <ScmBarcodeScanner
        open={findOpen}
        onOpenChange={setFindOpen}
        onResult={(code) => {
          setFindOpen(false);
          handleFindScan(code);
        }}
        title="Scan Order"
        placeholder="Pack, pick or sales order number"
      />

      <Dialog
        open={!!qrPackage}
        onOpenChange={(o) => {
          if (!o) setQrPackage(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Package QR Code</DialogTitle>
          </DialogHeader>
          {qrPackage && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload(
                "PACKAGE",
                qrPackage.pkg.packageNumber,
                qrPackage.packing.id,
              )}
              title={qrPackage.pkg.packageNumber}
              subtitle={qrPackage.packing.packNumber}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
