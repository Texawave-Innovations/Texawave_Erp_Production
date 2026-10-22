import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createRecord, getAllRecords, updateRecord } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import { useAuth } from "@/context/AuthContext";
import type { Warehouse, WarehouseStatus, WarehouseType } from "@/types";
import { logRecordAudit } from "@/services/auditLog";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage } from "@/modules/scm/shared/format";

const WAREHOUSE_TYPES: WarehouseType[] = [
  "Main",
  "Distribution",
  "Fulfillment",
  "Transit",
  "Returns",
  "Virtual",
  "Regional",
  "Other",
];

interface FormState {
  code: string;
  name: string;
  type: WarehouseType;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  managerName: string;
  status: WarehouseStatus;
  contactPerson: string;
  phone: string;
  email: string;
  capacity: string;
  capacityUnit: string;
  operatingHours: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    code: "",
    name: "",
    type: "Main",
    address: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",
    managerName: "",
    status: "Active",
    contactPerson: "",
    phone: "",
    email: "",
    capacity: "",
    capacityUnit: "SQFT",
    operatingHours: "",
    notes: "",
  };
}

function toForm(w: Warehouse): FormState {
  return {
    code: w.code || "",
    name: w.name || "",
    type: w.type || "Main",
    address: w.address || "",
    city: w.city || "",
    state: w.state || "",
    country: w.country || "India",
    postalCode: w.postalCode || "",
    managerName: w.managerName || "",
    status: w.status || "Active",
    contactPerson: w.contactPerson || "",
    phone: w.phone || "",
    email: w.email || "",
    capacity: w.capacity != null ? String(w.capacity) : "",
    capacityUnit: w.capacityUnit || "SQFT",
    operatingHours: w.operatingHours || "",
    notes: w.notes || "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: Warehouse | null;
  onSaved: () => void;
}

export default function ScmWarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const isEdit = !!warehouse;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(warehouse ? toForm(warehouse) : emptyForm());
  }, [open, warehouse]);

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Warehouse code and name are required");
      return;
    }
    setSaving(true);
    try {
      const code = form.code.trim().toUpperCase();
      const existing = (await getAllRecords(
        INVENTORY_PATHS.warehouses,
      )) as Warehouse[];
      if (
        existing.some(
          (w) =>
            w.id !== warehouse?.id &&
            (w.code || "").trim().toUpperCase() === code,
        )
      ) {
        throw new Error(`Warehouse code "${code}" is already in use`);
      }
      const payload = {
        code,
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        managerName: form.managerName.trim() || undefined,
        status: form.status,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        capacity: form.capacity.trim() ? Number(form.capacity) : undefined,
        capacityUnit: form.capacity.trim() ? form.capacityUnit : undefined,
        operatingHours: form.operatingHours.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const performedBy = actorName(user);
      if (isEdit && warehouse) {
        // Blank optional fields must be written as null to clear them (undefined is dropped).
        const cleared = Object.fromEntries(
          Object.entries(payload).map(([k, v]) => [k, v ?? null]),
        );
        await updateRecord(INVENTORY_PATHS.warehouses, warehouse.id, cleared);
        await logRecordAudit(
          INVENTORY_PATHS.warehouses,
          warehouse.id,
          "Warehouse updated",
          performedBy,
          `${payload.code} — ${payload.name}`,
        );
        toast.success("Warehouse updated");
      } else {
        const id = await createRecord(INVENTORY_PATHS.warehouses, payload);
        if (id)
          await logRecordAudit(
            INVENTORY_PATHS.warehouses,
            id,
            "Warehouse created",
            performedBy,
            `${payload.code} — ${payload.name}`,
          );
        toast.success("Warehouse created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save warehouse"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Warehouse" : "Add Warehouse"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Warehouse Code *</Label>
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="WH-CHN"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Warehouse Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Chennai Warehouse"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as WarehouseStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Postal Code</Label>
            <Input
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Manager</Label>
            <Input
              value={form.managerName}
              onChange={(e) => set("managerName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Person</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity</Label>
            <Input
              type="number"
              min="0"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity Unit</Label>
            <Select
              value={form.capacityUnit}
              onValueChange={(v) => set("capacityUnit", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SQFT">SQFT</SelectItem>
                <SelectItem value="PALLETS">Pallets</SelectItem>
                <SelectItem value="UNITS">Units</SelectItem>
                <SelectItem value="CBM">CBM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Operating Hours</Label>
            <Input
              value={form.operatingHours}
              onChange={(e) => set("operatingHours", e.target.value)}
              placeholder="e.g. Mon–Sat 9:00–18:00"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Create Warehouse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
