import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Plus, ScrollText, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  INSPECTION_STATUSES,
  INSPECTION_TYPE_LABEL,
  INSPECTION_TYPES,
  INSPECTION_STATUS_TONE,
  QUALITY_PRIORITIES,
  RESULT_TONE,
} from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import {
  createInspection,
  type CreateInspectionInput,
  type CreateInspectionItemInput,
} from "./inspectionService";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import ScmBarcodeScanner from "../barcode/components/ScmBarcodeScanner";
import { addScanHistoryEntry } from "../barcode/barcodeService";
import type { ScmQualityInspectionType, ScmQualityPriority } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";

const NO_TEMPLATE = "__none__";

export default function ScmQualityInspections() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = actorName(user);
  const data = useQualityData();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState<ScmQualityInspectionType>("INCOMING");
  const [newSourceId, setNewSourceId] = useState("");
  const [newPriority, setNewPriority] = useState<ScmQualityPriority>("MEDIUM");
  const [newWarehouseId, setNewWarehouseId] = useState("");
  const [invProductCode, setInvProductCode] = useState("");
  const [invQuantity, setInvQuantity] = useState("");
  const [templateId, setTemplateId] = useState(NO_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const typeTemplates = useMemo(
    () =>
      data.templates.filter((t) => t.active && t.inspectionType === newType),
    [data.templates, newType],
  );
  // Default to the first active template for the chosen type, so checkpoints are captured and
  // required-checkpoint validation runs at completion.
  useEffect(() => {
    setTemplateId(typeTemplates[0]?.id || NO_TEMPLATE);
  }, [typeTemplates]);

  const filtered = useMemo(() => {
    return data.inspections.filter((i) => {
      if (typeFilter !== ALL && i.inspectionType !== typeFilter) return false;
      if (statusFilter !== ALL && i.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const itemCodes = i.items
          .map(
            (it) =>
              `${it.productCode} ${it.batchNumber || ""} ${(it.serialNumbers || []).join(" ")}`,
          )
          .join(" ");
        const hay =
          `${i.inspectionNumber} ${i.sourceNumber || ""} ${i.supplierNameSnapshot || ""} ${i.customerNameSnapshot || ""} ${itemCodes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.inspections, typeFilter, statusFilter, search]);

  const handleScan = (code: string) => {
    const scanned = code.trim();
    const q = scanned.toLowerCase();
    const match = data.inspections.find(
      (i) =>
        i.inspectionNumber.toLowerCase() === q ||
        i.sourceNumber?.toLowerCase() === q ||
        i.items.some(
          (it) =>
            it.productCode.toLowerCase() === q ||
            it.batchNumber?.toLowerCase() === q ||
            it.serialNumbers?.some((s) => s.toLowerCase() === q),
        ),
    );
    if (!match) {
      setSearch(scanned);
      toast.error(
        `No inspection matches "${scanned}" — showing search results`,
      );
      addScanHistoryEntry({
        code: scanned,
        type: "UNKNOWN",
        label: "Not found",
        source: "QUALITY",
      });
      return;
    }
    addScanHistoryEntry({
      code: scanned,
      type: "GRN",
      label: match.inspectionNumber,
      viewPath: `/scm/quality/inspections/${match.id}`,
      source: "QUALITY",
    });
    navigate(`/scm/quality/inspections/${match.id}`);
  };

  const sourceOptions = useMemo(() => {
    if (newType === "INCOMING")
      return data.grns
        .filter((g) => g.status === "COMPLETED")
        .map((g) => ({
          id: g.id,
          label: `${g.grnNumber} — ${g.vendorNameSnapshot || g.vendorId}`,
        }));
    if (newType === "CUSTOMER_RETURN")
      return data.returns
        .filter(
          (r) => r.status === "RECEIVED" || r.status === "INSPECTION_PENDING",
        )
        .map((r) => ({
          id: r.id,
          label: `${r.returnNumber} — ${r.customerNameSnapshot || r.customerId}`,
        }));
    if (newType === "PRE_DISPATCH")
      return data.fulfillments
        .filter((f) => !["CANCELLED", "FULFILLED"].includes(f.status))
        .map((f) => ({
          id: f.id,
          label: `${f.fulfillmentNumber} — ${f.customerNameSnapshot}`,
        }));
    return [];
  }, [newType, data.grns, data.returns, data.fulfillments]);

  const resetCreateForm = () => {
    setNewType("INCOMING");
    setNewSourceId("");
    setNewPriority("MEDIUM");
    setNewWarehouseId("");
    setInvProductCode("");
    setInvQuantity("");
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      let input: CreateInspectionInput;

      if (newType === "INVENTORY") {
        if (!newWarehouseId) throw new Error("Select a warehouse.");
        if (!invProductCode) throw new Error("Select a product.");
        const qty = Number(invQuantity) || 0;
        if (qty <= 0)
          throw new Error("Quantity to inspect must be greater than zero.");
        const balance = data.stockBalances.find(
          (b) =>
            b.productCode === invProductCode &&
            b.warehouseId === newWarehouseId,
        );
        const available = balance
          ? balance.onHand - (balance.reserved || 0)
          : 0;
        if (qty > available)
          throw new Error(
            `Only ${Math.max(0, available)} available for this product at this warehouse.`,
          );
        const product = data.products.find(
          (p) => p.productCode === invProductCode,
        );
        const items: CreateInspectionItemInput[] = [
          {
            productCode: invProductCode,
            productNameSnapshot: product?.name || invProductCode,
            sourceQuantity: qty,
            warehouseId: newWarehouseId,
          },
        ];
        input = {
          inspectionType: "INVENTORY",
          sourceType: "INVENTORY",
          sourceId: `${invProductCode}__${newWarehouseId}`,
          sourceNumber: invProductCode,
          warehouseId: newWarehouseId,
          warehouseNameSnapshot: data.warehouses.find(
            (w) => w.id === newWarehouseId,
          )?.name,
          priority: newPriority,
          items,
        };
      } else if (newType === "INCOMING") {
        const grn = data.grns.find((g) => g.id === newSourceId);
        if (!grn) throw new Error("Select a GRN.");
        const items: CreateInspectionItemInput[] = grn.items
          .map((it, idx) => {
            const batch = it.batchNumber
              ? data.batches.find(
                  (b) =>
                    b.productCode === it.productCode &&
                    b.batchNumber === it.batchNumber &&
                    b.warehouseId === grn.warehouseId,
                )
              : undefined;
            return {
              productCode: it.productCode,
              productNameSnapshot: it.productName,
              sourceLineId: `${grn.id}:${idx}`,
              batchId: batch?.id,
              batchNumber: it.batchNumber,
              serialNumbers: it.serialNumbers,
              orderedQuantity: it.orderedQuantity,
              sourceQuantity: it.acceptedQuantity,
              unitCost: it.unitCost,
              warehouseId: grn.warehouseId,
              locationId: grn.locationId,
            };
          })
          .filter((it) => it.sourceQuantity > 0);
        if (items.length === 0)
          throw new Error("This GRN has no accepted quantity to inspect.");
        input = {
          inspectionType: "INCOMING",
          sourceType: "GRN",
          sourceId: grn.id,
          sourceNumber: grn.grnNumber,
          supplierId: grn.vendorId,
          supplierNameSnapshot: grn.vendorNameSnapshot,
          warehouseId: grn.warehouseId,
          warehouseNameSnapshot: data.warehouses.find(
            (w) => w.id === grn.warehouseId,
          )?.name,
          locationId: grn.locationId,
          priority: newPriority,
          items,
        };
      } else if (newType === "CUSTOMER_RETURN") {
        const ret = data.returns.find((r) => r.id === newSourceId);
        if (!ret) throw new Error("Select a customer return.");
        const items: CreateInspectionItemInput[] = ret.items
          .map((it) => ({
            productCode: it.productCode,
            productNameSnapshot: it.productNameSnapshot,
            sourceLineId: it.id,
            batchId: it.batchId,
            batchNumber: it.batchNumber,
            serialNumbers: it.serialNumbers,
            orderedQuantity: it.requestedQuantity,
            sourceQuantity: it.receivedReturnQuantity ?? it.requestedQuantity,
            unitCost: it.unitCost,
            warehouseId: it.warehouseId || ret.warehouseId,
            locationId: it.locationId,
          }))
          .filter((it) => it.sourceQuantity > 0);
        if (items.length === 0)
          throw new Error("This return has no received quantity to inspect.");
        input = {
          inspectionType: "CUSTOMER_RETURN",
          sourceType: "RETURN",
          sourceId: ret.id,
          sourceNumber: ret.returnNumber,
          customerId: ret.customerId,
          customerNameSnapshot: ret.customerNameSnapshot,
          warehouseId: ret.warehouseId,
          warehouseNameSnapshot: data.warehouses.find(
            (w) => w.id === ret.warehouseId,
          )?.name,
          priority: newPriority,
          items,
        };
      } else {
        const ff = data.fulfillments.find((f) => f.id === newSourceId);
        if (!ff) throw new Error("Select a fulfillment.");
        const items: CreateInspectionItemInput[] = ff.items
          .map((it, idx) => ({
            productCode: it.itemCode,
            productNameSnapshot: it.itemDescription,
            sourceLineId: `${ff.id}:${idx}`,
            orderedQuantity: it.orderedQty,
            sourceQuantity: it.reservedQty || it.issuedQty || it.orderedQty,
            warehouseId: ff.warehouseId,
          }))
          .filter((it) => it.sourceQuantity > 0);
        if (items.length === 0)
          throw new Error(
            "This fulfillment has no reserved/issued quantity to inspect.",
          );
        input = {
          inspectionType: "PRE_DISPATCH",
          sourceType: "FULFILLMENT",
          sourceId: ff.id,
          sourceNumber: ff.fulfillmentNumber,
          customerId: ff.customerId,
          customerNameSnapshot: ff.customerNameSnapshot,
          warehouseId: ff.warehouseId,
          warehouseNameSnapshot: data.warehouses.find(
            (w) => w.id === ff.warehouseId,
          )?.name,
          priority: newPriority,
          items,
        };
      }

      const id = await createInspection(
        {
          ...input,
          templateId: templateId === NO_TEMPLATE ? undefined : templateId,
        },
        performedBy,
      );
      toast.success("QC inspection created");
      setCreateOpen(false);
      navigate(`/scm/quality/inspections/${id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create inspection"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Quality Inspections
          </h2>
          <p className="text-muted-foreground mt-1">
            Incoming, customer return, inventory and pre-dispatch QC
            inspections.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" /> Scan GRN / Product / Batch /
            Serial / Return
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Inspection
          </Button>
        </div>
      </div>

      {data.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {data.error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search inspection #, source #, product, supplier/customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Types</SelectItem>
              {INSPECTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {INSPECTION_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {INSPECTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {data.loading ? (
            <div className="text-center py-16 text-muted-foreground">
              Loading inspections...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>No QC inspections yet.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inspection #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Supplier/Customer</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow
                      key={i.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        navigate(`/scm/quality/inspections/${i.id}`)
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {i.inspectionNumber}
                      </TableCell>
                      <TableCell>
                        {INSPECTION_TYPE_LABEL[i.inspectionType]}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {i.sourceNumber || i.sourceId}
                      </TableCell>
                      <TableCell>
                        {i.supplierNameSnapshot ||
                          i.customerNameSnapshot ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        {i.warehouseNameSnapshot || i.warehouseId || "—"}
                      </TableCell>
                      <TableCell>{i.inspectorName || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={INSPECTION_STATUS_TONE[i.status]}
                        >
                          {formatStatusLabel(i.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {i.result ? (
                          <Badge
                            variant="outline"
                            className={RESULT_TONE[i.result]}
                          >
                            {formatStatusLabel(i.result)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(i.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New QC Inspection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Inspection Type *</Label>
              <Select
                value={newType}
                onValueChange={(v) => {
                  setNewType(v as ScmQualityInspectionType);
                  setNewSourceId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INSPECTION_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newType === "INVENTORY" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Warehouse *</Label>
                  <Select
                    value={newWarehouseId}
                    onValueChange={setNewWarehouseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Product *</Label>
                  <Select
                    value={invProductCode}
                    onValueChange={setInvProductCode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.products.map((p) => (
                        <SelectItem key={p.productCode} value={p.productCode}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantity to Inspect *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={invQuantity}
                    onChange={(e) => setInvQuantity(e.target.value)}
                  />
                  {invProductCode && newWarehouseId && (
                    <p className="text-xs text-muted-foreground">
                      Available:{" "}
                      {(() => {
                        const b = data.stockBalances.find(
                          (x) =>
                            x.productCode === invProductCode &&
                            x.warehouseId === newWarehouseId,
                        );
                        return b ? b.onHand - (b.reserved || 0) : 0;
                      })()}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Source Document *</Label>
                <Select value={newSourceId} onValueChange={setNewSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No eligible source documents.
                      </div>
                    )}
                    {sourceOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>QC Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>
                    No template (no checkpoints)
                  </SelectItem>
                  {typeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.templateCode} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={newPriority}
                onValueChange={(v) => setNewPriority(v as ScmQualityPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={handleCreate}>
              {busy ? "Creating..." : "Create Inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScmBarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={(code) => {
          setScanOpen(false);
          handleScan(code);
        }}
        title="Scan GRN / Product / Batch / Serial / Return"
        placeholder="GRN, product, batch, serial or return number"
      />
    </div>
  );
}
