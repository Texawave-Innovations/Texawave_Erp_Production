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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createRecord, getAllRecords, updateRecord } from "@/services/firebase";
import { indianStates, GST_STATE_CODES } from "@/constants";
import type { Address, Vendor, VendorStatus } from "@/types";
import {
  SUPPLIER_STATUSES,
  claimSupplierCode,
  nextSupplierCode,
} from "./supplierHelpers";
import { validateGSTIN, validatePANNumber } from "@/utils/formValidators";
import { errorMessage } from "@/modules/scm/shared/format";
import { useAuth } from "@/context/AuthContext";
import { logRecordAudit } from "@/services/auditLog";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { actorName } from "@/modules/scm/shared/actor";

interface FormState {
  vendorCode: string;
  companyName: string;
  type: string;
  status: VendorStatus;
  gst: string;
  pan: string;
  contactPerson: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  paymentTerms: string;
  creditLimit: string;
  currency: string;
  leadTimeDays: string;
  rating: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    vendorCode: "",
    companyName: "",
    type: "",
    status: "Active",
    gst: "",
    pan: "",
    contactPerson: "",
    phone: "",
    email: "",
    street: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    paymentTerms: "30 Days",
    creditLimit: "",
    currency: "INR",
    leadTimeDays: "",
    rating: "",
    notes: "",
  };
}

function toForm(v: Vendor): FormState {
  const addr = v.addresses?.find((a) => a.isDefault) || v.addresses?.[0];
  return {
    vendorCode: v.vendorCode || "",
    companyName: v.companyName || "",
    type: v.type || "",
    status: v.status || "Active",
    gst: v.gst || "",
    pan: v.pan || "",
    contactPerson: v.contactPerson || "",
    phone: v.phone || "",
    email: v.email || "",
    street: addr?.street || "",
    city: addr?.city || "",
    state: addr?.state || "",
    country: addr?.country || "India",
    pincode: addr?.pincode || "",
    paymentTerms: v.paymentTerms || "30 Days",
    creditLimit: v.creditLimit != null ? String(v.creditLimit) : "",
    currency: v.currency || "INR",
    leadTimeDays: v.leadTimeDays != null ? String(v.leadTimeDays) : "",
    rating: v.rating != null ? String(v.rating) : "",
    notes: v.notes || "",
  };
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

/** Updates the default (or first) address in place and keeps every other address the supplier
 * has — the form only edits one address, so it must not drop the rest. */
function mergeDefaultAddress(
  existing: Address[] | undefined,
  fields: Pick<Address, "street" | "city" | "state" | "pincode" | "country">,
): Address[] {
  const list = existing || [];
  const idx = Math.max(
    0,
    list.findIndex((a) => a.isDefault),
  );
  if (list.length === 0) {
    return [
      {
        id: "addr-1",
        type: "billing",
        label: "Primary",
        ...fields,
        isDefault: true,
      },
    ];
  }
  return list.map((a, i) =>
    i === idx ? { ...a, ...fields, isDefault: true } : a,
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
  onSaved: () => void;
}

export default function ScmSupplierFormDialog({
  open,
  onOpenChange,
  vendor,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const isEdit = !!vendor;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      setForm(toForm(vendor));
      return;
    }
    setForm(emptyForm());
    let cancelled = false;
    (async () => {
      try {
        const existing = (await getAllRecords(
          SCM_CROSS_MODULE_PATHS.vendors,
        )) as Vendor[];
        if (!cancelled)
          setForm((f) => ({ ...f, vendorCode: nextSupplierCode(existing) }));
      } catch {
        if (!cancelled)
          setForm((f) => ({
            ...f,
            vendorCode: `VEND-${Date.now().toString().slice(-4)}`,
          }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, vendor]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleGstChange = (raw: string) => {
    const cleaned = raw.toUpperCase().slice(0, 15);
    if (cleaned.length === 15 && validateGSTIN(cleaned)) {
      const mappedState = GST_STATE_CODES[cleaned.slice(0, 2)];
      setForm((f) => ({ ...f, gst: cleaned, state: mappedState || f.state }));
    } else {
      setForm((f) => ({ ...f, gst: cleaned }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!form.contactPerson.trim()) {
      toast.error("Primary contact name is required");
      return;
    }
    if (!form.vendorCode.trim()) {
      toast.error("Supplier code is required");
      return;
    }
    if (form.gst && !validateGSTIN(form.gst)) {
      toast.error("Invalid GSTIN format");
      return;
    }
    if (form.pan && !validatePANNumber(form.pan.toUpperCase())) {
      toast.error("Invalid PAN format (e.g., ABCDE1234F)");
      return;
    }
    if (!CURRENCY_CODE.test(form.currency.trim())) {
      toast.error("Currency must be a 3-letter ISO code (e.g., INR, USD)");
      return;
    }
    if (form.rating && (Number(form.rating) < 1 || Number(form.rating) > 5)) {
      toast.error("Rating must be between 1 and 5");
      return;
    }

    setSaving(true);
    try {
      // Duplicate supplier code / GSTIN guard. The GSTIN check is a best-effort client-side check
      // against the already-loaded vendor list (RTDB, no server-side uniqueness constraint
      // available) — a friendly early error, not a hard guarantee. The vendor code additionally
      // gets an atomic claim below, since a plain check-then-write here is exactly what let two
      // concurrent creations both land "VEND-0003" in production (see claimSupplierCode).
      const existing = (await getAllRecords(
        SCM_CROSS_MODULE_PATHS.vendors,
      )) as Vendor[];
      const trimmedCode = form.vendorCode.trim();
      const codeClash = existing.find(
        (v) =>
          v.id !== vendor?.id &&
          v.vendorCode?.toLowerCase() === trimmedCode.toLowerCase(),
      );
      if (codeClash) {
        toast.error(
          `Supplier code "${form.vendorCode}" is already used by ${codeClash.companyName}`,
        );
        setSaving(false);
        return;
      }
      if (form.gst) {
        const gstClash = existing.find(
          (v) =>
            v.id !== vendor?.id &&
            v.gst?.toUpperCase() === form.gst.toUpperCase(),
        );
        if (gstClash) {
          toast.error(`GSTIN is already used by ${gstClash.companyName}`);
          setSaving(false);
          return;
        }
      }

      // Only claim when the code is actually changing — re-saving an existing supplier's other
      // fields with its code untouched must not fail just because that code was already claimed
      // (by itself, or — for the pre-existing "VEND-0003" duplicates — by whichever of the two
      // claims it first). Fixing already-corrupted production codes is explicitly out of scope.
      const codeChanged =
        !vendor ||
        vendor.vendorCode?.toLowerCase() !== trimmedCode.toLowerCase();
      if (codeChanged) {
        const claimed = await claimSupplierCode(trimmedCode);
        if (!claimed) {
          toast.error(
            `Supplier code "${form.vendorCode}" is already in use. Choose a different code and try again.`,
          );
          setSaving(false);
          return;
        }
      }

      const payload = {
        vendorCode: form.vendorCode.trim(),
        companyName: form.companyName.trim(),
        type: form.type.trim(),
        status: form.status,
        gst: form.gst.trim(),
        pan: form.pan.trim().toUpperCase(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        addresses: mergeDefaultAddress(vendor?.addresses, {
          street: form.street,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: form.country,
        }),
        paymentTerms: form.paymentTerms.trim(),
        creditLimit: form.creditLimit ? Number(form.creditLimit) : 0,
        currency: form.currency.trim(),
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : 0,
        rating: form.rating ? Number(form.rating) : null, // null clears a removed rating
        notes: form.notes.trim(),
      };

      if (isEdit && vendor) {
        await updateRecord(SCM_CROSS_MODULE_PATHS.vendors, vendor.id, payload);
        await logRecordAudit(
          SCM_CROSS_MODULE_PATHS.vendors,
          vendor.id,
          "Supplier updated",
          actorName(user),
          `Updated by ${user?.name || "a user"}`,
        );
        toast.success("Supplier updated");
      } else {
        const newId = await createRecord(
          SCM_CROSS_MODULE_PATHS.vendors,
          payload,
        );
        if (newId)
          await logRecordAudit(
            SCM_CROSS_MODULE_PATHS.vendors,
            newId,
            "Supplier created",
            actorName(user),
            `Created by ${user?.name || "a user"}`,
          );
        toast.success("Supplier created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save supplier"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier Code</Label>
                <Input
                  value={form.vendorCode}
                  onChange={(e) => set("vendorCode", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder="ABC Suppliers Pvt Ltd"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Supplier Type</Label>
                <Input
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  placeholder="Manufacturer, Distributor..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v as VendorStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tax Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input
                  value={form.gst}
                  onChange={(e) => handleGstChange(e.target.value)}
                  placeholder="33AAAAA0000A1Z5"
                  maxLength={15}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>PAN</Label>
                <Input
                  value={form.pan}
                  onChange={(e) =>
                    set("pan", e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Primary Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Contact Name *</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) => set("contactPerson", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    set("phone", e.target.value.replace(/\D/g, "").slice(0, 15))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
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
                <Select
                  value={form.state}
                  onValueChange={(v) => set("state", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {indianStates.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  value={form.pincode}
                  onChange={(e) =>
                    set(
                      "pincode",
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  className="font-mono"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Commercial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input
                  value={form.paymentTerms}
                  onChange={(e) => set("paymentTerms", e.target.value)}
                  placeholder="30 Days"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.creditLimit}
                  onChange={(e) => set("creditLimit", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency *</Label>
                <Input
                  value={form.currency}
                  onChange={(e) =>
                    set("currency", e.target.value.toUpperCase().slice(0, 3))
                  }
                  placeholder="INR"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.leadTimeDays}
                  onChange={(e) => set("leadTimeDays", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Other
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Rating (1–5, optional)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) => set("rating", e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Supplier"
                  : "Create Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
