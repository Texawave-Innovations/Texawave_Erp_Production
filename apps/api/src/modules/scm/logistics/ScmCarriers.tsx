import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Building2, Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  CARRIER_STATUS_TONE,
  SHIPMENT_SERVICE_TYPES,
  useCarriers,
} from "./logisticsHelpers";
import { createCarrier, updateCarrier } from "./logisticsService";
import type { LogisticsCarrier, ShipmentServiceType } from "@/types";
import { actorName } from "@/modules/scm/shared/actor";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";

const emptyForm = {
  carrierCode: "",
  carrierName: "",
  serviceTypes: [] as ShipmentServiceType[],
  contact: "",
  phone: "",
  email: "",
  website: "",
  trackingUrlTemplate: "",
  notes: "",
};

export default function ScmCarriers() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, carriers, shipments, reload } = useCarriers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsCarrier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const shipmentCountByCarrier = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shipments)
      if (s.carrierId) map[s.carrierId] = (map[s.carrierId] || 0) + 1;
    return map;
  }, [shipments]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (c: LogisticsCarrier) => {
    setEditing(c);
    setForm({
      carrierCode: c.carrierCode,
      carrierName: c.carrierName,
      serviceTypes: c.serviceTypes || [],
      contact: c.contact || "",
      phone: c.phone || "",
      email: c.email || "",
      website: c.website || "",
      trackingUrlTemplate: c.trackingUrlTemplate || "",
      notes: c.notes || "",
    });
    setDialogOpen(true);
  };

  const toggleServiceType = (st: ShipmentServiceType) => {
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(st)
        ? f.serviceTypes.filter((s) => s !== st)
        : [...f.serviceTypes, st],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateCarrier(
          editing,
          {
            carrierName: form.carrierName,
            serviceTypes: form.serviceTypes,
            contact: form.contact,
            phone: form.phone,
            email: form.email,
            website: form.website,
            trackingUrlTemplate: form.trackingUrlTemplate,
            notes: form.notes,
          },
          performedBy,
        );
        toast.success("Carrier updated");
      } else {
        await createCarrier(form, performedBy);
        toast.success("Carrier created");
      }
      setDialogOpen(false);
      reload();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save carrier"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: LogisticsCarrier) => {
    try {
      await updateCarrier(
        c,
        { status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
        performedBy,
      );
      toast.success(
        c.status === "ACTIVE" ? "Carrier deactivated" : "Carrier activated",
      );
      reload();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to update carrier"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Carriers</h2>
          <p className="text-muted-foreground mt-1">
            Carrier / logistics partner master.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Carrier
        </Button>
      </div>
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Service Types</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Shipments</TableHead>
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
                      Loading carriers...
                    </TableCell>
                  </TableRow>
                ) : carriers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Building2 className="h-10 w-10 text-muted-foreground/40" />
                        <div className="text-lg font-medium text-foreground">
                          No carriers yet
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  carriers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {c.carrierCode}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.carrierName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(c.serviceTypes || []).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.contact || c.phone || c.email || "—"}
                      </TableCell>
                      <TableCell>{shipmentCountByCarrier[c.id] || 0}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={CARRIER_STATUS_TONE[c.status]}
                        >
                          {formatStatusLabel(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            c.status === "ACTIVE" ? "Deactivate" : "Activate"
                          }
                          onClick={() => handleToggleStatus(c)}
                        >
                          <Power className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Carrier" : "Add Carrier"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Carrier Code *</Label>
                <Input
                  value={form.carrierCode}
                  disabled={!!editing}
                  onChange={(e) =>
                    setForm({ ...form, carrierCode: e.target.value })
                  }
                  placeholder="e.g. BLUEDART"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Carrier Name *</Label>
                <Input
                  value={form.carrierName}
                  onChange={(e) =>
                    setForm({ ...form, carrierName: e.target.value })
                  }
                  placeholder="e.g. Blue Dart Express"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Service Types</Label>
              <div className="flex flex-wrap gap-2">
                {SHIPMENT_SERVICE_TYPES.map((st) => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => toggleServiceType(st)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.serviceTypes.includes(st) ? "bg-brand-500 text-white border-brand-500" : "bg-white text-muted-foreground border-slate-200"}`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
                  value={form.contact}
                  onChange={(e) =>
                    setForm({ ...form, contact: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking URL Template</Label>
              <Input
                value={form.trackingUrlTemplate}
                onChange={(e) =>
                  setForm({ ...form, trackingUrlTemplate: e.target.value })
                }
                placeholder="https://track.example.com/{trackingNumber}"
              />
              <p className="text-xs text-muted-foreground">
                Use <code>{"{trackingNumber}"}</code> as the placeholder — it's
                replaced with the actual tracking number on each shipment.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving || !form.carrierCode.trim() || !form.carrierName.trim()
              }
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Carrier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
