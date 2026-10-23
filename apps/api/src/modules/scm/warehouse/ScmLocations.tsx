import { useMemo, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, MapPin, Power, QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { createRecord, updateRecord } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  CAPACITY_TONE,
  VALID_PARENT_TYPE,
  binOccupancy,
  buildLocationCode,
  capacityState,
  computeLocationStock,
  locationLabel,
  useWarehouseMasters,
  useWarehouseOperations,
} from "./warehouseHelpers";
import type { LocationType, WarehouseLocation } from "@/types";
import { errorMessage } from "@/modules/scm/shared/format";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { buildQrPayload } from "../barcode/barcodeHelpers";
import { addScanHistoryEntry } from "../barcode/barcodeService";

const LOCATION_TYPES: LocationType[] = ["ZONE", "RACK", "SHELF", "BIN"];

export default function ScmLocations() {
  const { user } = useAuth();
  const {
    loading,
    error,
    warehouses,
    locations,
    reload: load,
  } = useWarehouseMasters();
  const { putaways, movements, pickings } = useWarehouseOperations();
  const locationStock = useMemo(
    () => computeLocationStock(putaways, movements, pickings),
    [putaways, movements, pickings],
  );
  const [warehouseFilter, setWarehouseFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    warehouseId: "",
    locationType: "BIN" as LocationType,
    parentLocationId: "",
    code: "",
    locationName: "",
    capacity: "",
    capacityUnit: "UNITS",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [qrLocation, setQrLocation] = useState<WarehouseLocation | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [highlightLocId, setHighlightLocId] = useState<string | null>(null);

  const performedBy = actorName(user);

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name || "—";
  const locationById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  const ancestorChain = (
    loc: WarehouseLocation | undefined,
  ): WarehouseLocation[] => {
    const chain: WarehouseLocation[] = [];
    let cur = loc?.parentLocationId
      ? locationById.get(loc.parentLocationId)
      : undefined;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentLocationId
        ? locationById.get(cur.parentLocationId)
        : undefined;
    }
    return chain;
  };

  const filtered = useMemo(() => {
    return locations.filter(
      (l) =>
        (warehouseFilter === ALL || l.warehouseId === warehouseFilter) &&
        (typeFilter === ALL || (l.locationType || "BIN") === typeFilter),
    );
  }, [locations, warehouseFilter, typeFilter]);

  const openForm = () => {
    setForm({
      warehouseId: warehouses[0]?.id || "",
      locationType: "BIN",
      parentLocationId: "",
      code: "",
      locationName: "",
      capacity: "",
      capacityUnit: "UNITS",
      notes: "",
    });
    setFormOpen(true);
  };

  // Candidate parents for the selected type/warehouse — a ZONE's "parent" is the warehouse
  // itself (no location to pick), everything else must nest inside the correct parent type.
  const parentCandidates = useMemo(() => {
    const requiredType = VALID_PARENT_TYPE[form.locationType];
    if (!requiredType) return [];
    return locations.filter(
      (l) =>
        l.warehouseId === form.warehouseId &&
        (l.locationType || "BIN") === requiredType &&
        l.status === "Active",
    );
  }, [locations, form.warehouseId, form.locationType]);

  const handleSubmit = async () => {
    if (!form.warehouseId || !form.code.trim()) {
      toast.error("Warehouse and Code are required");
      return;
    }
    const requiredParentType = VALID_PARENT_TYPE[form.locationType];
    if (requiredParentType && !form.parentLocationId) {
      toast.error(
        `A ${form.locationType.toLowerCase()} must be placed inside a ${requiredParentType.toLowerCase()}`,
      );
      return;
    }
    const parent = form.parentLocationId
      ? locationById.get(form.parentLocationId)
      : undefined;
    if (
      requiredParentType &&
      parent &&
      (parent.locationType || "BIN") !== requiredParentType
    ) {
      toast.error(
        `Invalid parent — a ${form.locationType.toLowerCase()} must be placed inside a ${requiredParentType.toLowerCase()}`,
      );
      return;
    }

    setSaving(true);
    try {
      const warehouse = warehouses.find((w) => w.id === form.warehouseId);
      const ancestors = ancestorChain(parent).concat(parent ? [parent] : []);
      const draftNode: Partial<WarehouseLocation> = {
        binCode: form.code.trim().toUpperCase(),
        locationName: form.locationName.trim() || undefined,
      };
      const locationCode = buildLocationCode(draftNode, warehouse, ancestors);

      const duplicate = locations.some(
        (l) =>
          l.warehouseId === form.warehouseId &&
          (
            l.locationCode || buildLocationCode(l, warehouse, ancestorChain(l))
          ).toUpperCase() === locationCode,
      );
      if (duplicate) {
        toast.error(
          `Location code "${locationCode}" already exists in this warehouse`,
        );
        setSaving(false);
        return;
      }

      const payload: Omit<WarehouseLocation, "id"> = {
        warehouseId: form.warehouseId,
        parentLocationId: form.parentLocationId || undefined,
        locationType: form.locationType,
        locationCode,
        zone:
          form.locationType === "ZONE"
            ? form.code.trim().toUpperCase()
            : ancestors.find((a) => a.locationType === "ZONE")?.binCode,
        rack:
          form.locationType === "RACK"
            ? form.code.trim().toUpperCase()
            : ancestors.find((a) => a.locationType === "RACK")?.binCode,
        shelf:
          form.locationType === "SHELF"
            ? form.code.trim().toUpperCase()
            : ancestors.find((a) => a.locationType === "SHELF")?.binCode,
        binCode: form.code.trim().toUpperCase(),
        locationName: form.locationName.trim() || undefined,
        capacity: form.capacity.trim() ? Number(form.capacity) : undefined,
        capacityUnit: form.capacity.trim() ? form.capacityUnit : undefined,
        notes: form.notes.trim() || undefined,
        status: "Active",
        createdBy: performedBy,
        createdAt: Date.now(),
      };
      const id = await createRecord(INVENTORY_PATHS.locations, payload);
      if (id) {
        await logRecordAudit(
          INVENTORY_PATHS.locations,
          id,
          "Location created",
          performedBy,
          `${form.locationType} ${locationCode}`,
        );
      }
      toast.success("Location created");
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create location"));
    } finally {
      setSaving(false);
    }
  };

  const handleScanLocation = (code: string) => {
    const scanned = code.trim();
    const loc = locations.find(
      (l) =>
        (l.locationCode || l.binCode).toLowerCase() === scanned.toLowerCase(),
    );
    if (!loc) {
      toast.error(`No location found for "${scanned}"`);
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "LOCATION",
      });
      return;
    }
    setWarehouseFilter(loc.warehouseId);
    setTypeFilter(ALL);
    setHighlightLocId(loc.id);
    document
      .getElementById(`loc-row-${loc.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.success(
      `Found ${loc.locationCode || loc.binCode} — ${warehouseName(loc.warehouseId)}, ${loc.status}`,
    );
    addScanHistoryEntry({
      code: scanned,
      type: "LOCATION",
      label: loc.locationCode || loc.binCode,
      source: "LOCATION",
    });
    window.setTimeout(
      () => setHighlightLocId((cur) => (cur === loc.id ? null : cur)),
      3000,
    );
  };

  const toggleActive = async (loc: WarehouseLocation) => {
    const next = loc.status === "Active" ? "Inactive" : "Active";
    try {
      await updateRecord(INVENTORY_PATHS.locations, loc.id, {
        status: next,
        updatedAt: Date.now(),
      });
      await logRecordAudit(
        INVENTORY_PATHS.locations,
        loc.id,
        "Location status changed",
        performedBy,
        `${loc.status} → ${next}`,
      );
      toast.success(`Location marked ${next}`);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to update location"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Locations</h2>
          <p className="text-muted-foreground mt-1">
            Zone → Rack → Shelf → Bin hierarchy within each warehouse. Optional
            on a stock ledger entry.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setScanOpen(true)}
            disabled={locations.length === 0}
          >
            <ScanLine className="h-4 w-4 mr-2" /> Scan Location
          </Button>
          <Button onClick={openForm} disabled={warehouses.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {!loading && warehouses.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Create a warehouse first under Warehouse → Warehouses.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4 flex flex-row flex-wrap gap-3 items-center">
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[220px]">
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Types</SelectItem>
              {LOCATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {filtered.length} of {locations.length} locations
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Code</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Capacity</TableHead>
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
                      Loading locations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <MapPin className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No locations yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((loc) => {
                    const occupied = binOccupancy(
                      locationStock,
                      loc.warehouseId,
                      loc.id,
                    );
                    const cs = capacityState(loc.capacity, occupied);
                    return (
                      <TableRow
                        id={`loc-row-${loc.id}`}
                        key={loc.id}
                        className={`hover:bg-muted/50 transition-colors ${highlightLocId === loc.id ? "bg-brand-50/60" : ""}`}
                      >
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {locationLabel(loc)}
                          </Badge>
                        </TableCell>
                        <TableCell>{warehouseName(loc.warehouseId)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {loc.locationType || "BIN"}
                          </Badge>
                        </TableCell>
                        <TableCell>{loc.locationName || "—"}</TableCell>
                        <TableCell>
                          {loc.capacity ? (
                            <Badge
                              variant="outline"
                              className={CAPACITY_TONE[cs]}
                            >
                              {occupied}/{loc.capacity} {loc.capacityUnit}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Unconfigured
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              loc.status === "Active"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                : "text-muted-foreground"
                            }
                          >
                            {loc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="QR Code / Label"
                            onClick={() => setQrLocation(loc)}
                          >
                            <QrCode className="h-4 w-4 text-brand-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={
                              loc.status === "Active"
                                ? "Deactivate"
                                : "Activate"
                            }
                            onClick={() => toggleActive(loc)}
                          >
                            <Power
                              className={`h-4 w-4 ${loc.status === "Active" ? "text-emerald-600" : "text-muted-foreground"}`}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Warehouse *</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    warehouseId: v,
                    parentLocationId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Location Type *</Label>
              <Select
                value={form.locationType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    locationType: v as LocationType,
                    parentLocationId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {VALID_PARENT_TYPE[form.locationType] && (
              <div className="col-span-2 space-y-1.5">
                <Label>Parent {VALID_PARENT_TYPE[form.locationType]} *</Label>
                <Select
                  value={form.parentLocationId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, parentLocationId: v }))
                  }
                  disabled={!form.warehouseId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        parentCandidates.length
                          ? "Select parent"
                          : `No ${VALID_PARENT_TYPE[form.locationType]?.toLowerCase()}s yet`
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {parentCandidates.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.locationCode || p.binCode}
                        {p.locationName ? ` — ${p.locationName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="Z01 / R03 / S02 / B05"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.locationName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locationName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity Unit</Label>
              <Select
                value={form.capacityUnit}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, capacityUnit: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNITS">Units</SelectItem>
                  <SelectItem value="KG">KG</SelectItem>
                  <SelectItem value="CBM">CBM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
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
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrLocation}
        onOpenChange={(o) => {
          if (!o) setQrLocation(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Location QR Code</DialogTitle>
          </DialogHeader>
          {qrLocation && (
            <ScmBarcodeLabel
              format="QR"
              value={buildQrPayload(
                "LOCATION",
                qrLocation.locationCode || qrLocation.binCode,
                qrLocation.id,
              )}
              title={qrLocation.locationCode || qrLocation.binCode}
              subtitle={qrLocation.locationName}
              footer={`Warehouse: ${warehouseName(qrLocation.warehouseId)}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScanLocation(code);
        }}
        title="Scan Location"
        placeholder="Location / bin code"
      />
    </div>
  );
}
