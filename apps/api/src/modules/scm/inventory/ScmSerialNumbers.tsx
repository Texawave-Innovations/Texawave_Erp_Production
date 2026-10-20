import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Hash, Tag } from "lucide-react";
import { toast } from "sonner";
import { createRecord, getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "./inventoryPaths";
import { useInventoryData } from "./useInventoryData";
import { useErrorToast } from "@/modules/scm/shared/useErrorToast";
import { useAuth } from "@/context/AuthContext";
import ScmBarcodeLabel from "../barcode/components/ScmBarcodeLabel";
import type { SerialNumberRecord, SerialStatus } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { ALL, errorMessage } from "@/modules/scm/shared/format";

const STATUS_TONE: Record<SerialStatus, string> = {
  AVAILABLE: "text-emerald-600 border-emerald-200 bg-emerald-50",
  RESERVED: "text-amber-600 border-amber-200 bg-amber-50",
  SOLD: "text-sky-600 border-sky-200 bg-sky-50",
  TRANSFERRED: "text-purple-600 border-purple-200 bg-purple-50",
  DAMAGED: "text-red-600 border-red-200 bg-red-50",
  RETURNED: "text-slate-600 border-slate-200 bg-slate-50",
  QUARANTINED: "text-purple-600 border-purple-200 bg-purple-50",
};

export default function ScmSerialNumbers() {
  const { user } = useAuth();
  const { products, warehouses, error: inventoryError } = useInventoryData();
  useErrorToast(inventoryError);
  const [serials, setSerials] = useState<SerialNumberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    serialNumbers: "",
    productCode: "",
    warehouseId: "",
  });
  const [labelSerial, setLabelSerial] = useState<SerialNumberRecord | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    try {
      const s = (await getAllRecords(
        INVENTORY_PATHS.serials,
      )) as SerialNumberRecord[];
      setSerials(s.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)));
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to load serial numbers"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? serials
        : serials.filter((s) => s.status === statusFilter),
    [serials, statusFilter],
  );

  const openForm = () => {
    setForm({
      serialNumbers: "",
      productCode: products[0]?.productCode || "",
      warehouseId: warehouses[0]?.id || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const list = form.serialNumbers
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!form.productCode || !form.warehouseId) {
      toast.error("Select a product and warehouse");
      return;
    }
    if (list.length === 0) {
      toast.error("Enter at least one serial number");
      return;
    }
    if (new Set(list).size !== list.length) {
      toast.error("Duplicate serial numbers entered");
      return;
    }
    setSaving(true);
    try {
      // Serial numbers are unique per product — re-read so the check isn't against a stale list.
      const existing = (await getAllRecords(
        INVENTORY_PATHS.serials,
      )) as SerialNumberRecord[];
      const taken = new Set(
        existing
          .filter((s) => s.productCode === form.productCode)
          .map((s) => s.serialNumber),
      );
      const dup = list.find((sn) => taken.has(sn));
      if (dup) {
        toast.error(`Serial number "${dup}" already exists for this product`);
        return;
      }

      const product = products.find((p) => p.productCode === form.productCode);
      const performedBy = actorName(user);
      for (const serialNumber of list) {
        const id = await createRecord(INVENTORY_PATHS.serials, {
          serialNumber,
          productCode: form.productCode,
          productName: product?.name || form.productCode,
          warehouseId: form.warehouseId,
          status: "AVAILABLE" as SerialStatus,
          createdBy: performedBy,
        });
        if (id)
          await logRecordAudit(
            INVENTORY_PATHS.serials,
            id,
            "Serial number created",
            performedBy,
            serialNumber,
          );
      }
      toast.success(`${list.length} serial number(s) created`);
      setFormOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create serial numbers"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Serial Numbers</h2>
          <p className="text-muted-foreground mt-1">
            Serial-number tracked stock, for products that require unit-level
            traceability. Registering serial numbers here does not change
            on-hand stock — post a receipt or adjustment for that.
          </p>
        </div>
        <Button
          onClick={openForm}
          disabled={products.length === 0 || warehouses.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Serial Numbers
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {(Object.keys(STATUS_TONE) as SerialStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground pt-1">
            {filtered.length} of {serials.length} serial numbers
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Reference</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      Loading serial numbers...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Hash className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No serial numbers yet.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow
                      key={s.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs">
                        {s.serialNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {s.productCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {warehouses.find((w) => w.id === s.warehouseId)?.name ||
                          s.warehouseId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[s.status]}
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.currentReference || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Label"
                          onClick={() => setLabelSerial(s)}
                        >
                          <Tag className="h-4 w-4 text-brand-600" />
                        </Button>
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
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Serial Numbers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select
                value={form.productCode}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, productCode: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.productCode} value={p.productCode}>
                      {p.name} ({p.productCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse *</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, warehouseId: v }))
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
            <div className="space-y-1.5">
              <Label>Serial Numbers *</Label>
              <Textarea
                value={form.serialNumbers}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serialNumbers: e.target.value }))
                }
                placeholder="One per line, or comma separated"
                rows={5}
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
              {saving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!labelSerial}
        onOpenChange={(o) => {
          if (!o) setLabelSerial(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Serial Number Label</DialogTitle>
          </DialogHeader>
          {labelSerial && (
            <ScmBarcodeLabel
              format="CODE128"
              value={labelSerial.serialNumber}
              title={labelSerial.productName}
              subtitle={`Serial ${labelSerial.serialNumber}`}
              footer={`Warehouse: ${warehouses.find((w) => w.id === labelSerial.warehouseId)?.name || labelSerial.warehouseId}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
