// CRM Core Domain — Account create/edit form. A single reusable, tabbed dialog used both by
// Accounts.tsx ("Add Account") and AccountDetail.tsx ("Edit Account"), so the two entry points
// never drift out of sync. Purely additive on top of the original 7-field inline dialog — every
// field that already existed keeps its name/behavior, new fields are optional and organized into
// sections instead of one flat grid.
import { useEffect, useState } from "react";
import {
  Building2,
  Contact,
  MapPin,
  Briefcase,
  FileText,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { celebrateCrm } from "../celebration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  createCrmAccount,
  updateCrmAccount,
  findPossibleDuplicateAccount,
} from "./accountsService";
import { CrmAccount, CrmAccountInput } from "./types";
import {
  useCrmCustomFields,
  CrmCustomFieldDef,
} from "../bulkImport/crmCustomFieldsService";

const FORM_TABS = [
  {
    id: "company",
    label: "Company Information",
    icon: Building2,
    tone: "brand",
  },
  { id: "contact", label: "Contact Details", icon: Contact, tone: "blue" },
  { id: "address", label: "Address", icon: MapPin, tone: "purple" },
  { id: "profile", label: "Business Profile", icon: Briefcase, tone: "amber" },
  { id: "more", label: "Additional Information", icon: FileText, tone: "teal" },
] as const;

type TabTone = (typeof FORM_TABS)[number]["tone"];

const TAB_TONE_STYLE: Record<
  TabTone,
  {
    border: string;
    bgSubtle: string;
    iconBg: string;
    iconColor: string;
    accentLine: string;
  }
> = {
  brand: {
    border: "border-brand-200",
    bgSubtle: "bg-brand-50/50",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-600",
    accentLine: "border-brand-200",
  },
  blue: {
    border: "border-blue-200",
    bgSubtle: "bg-blue-50/50",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accentLine: "border-blue-200",
  },
  purple: {
    border: "border-purple-200",
    bgSubtle: "bg-purple-50/50",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    accentLine: "border-purple-200",
  },
  amber: {
    border: "border-amber-200",
    bgSubtle: "bg-amber-50/50",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accentLine: "border-amber-200",
  },
  teal: {
    border: "border-teal-200",
    bgSubtle: "bg-teal-50/50",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    accentLine: "border-teal-200",
  },
};

const emptyForm = (currentUser: string): CrmAccountInput => ({
  name: "",
  industry: "",
  website: "",
  hq: "",
  phone: "",
  email: "",
  linkedin: "",
  ownerName: "",
  createdBy: currentUser,
  accountType: "Prospect",
  registrationNumber: "",
  numberOfEmployees: undefined,
  annualRevenue: undefined,
  description: "",
  tags: [],
  billingStreet: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "",
  shippingStreet: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  customerCategory: undefined,
  customerClass: undefined,
  businessType: undefined,
  resellerType: "",
  customFields: {},
});

function toForm(account: CrmAccount): CrmAccountInput {
  const { id, createdAt, updatedAt, ...rest } = account;
  return { ...emptyForm(account.createdBy), ...rest };
}

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  account?: CrmAccount;
  currentUser: string;
  /** All known accounts, used for a duplicate-name/domain/email warning before creating a new one. */
  existingAccounts?: CrmAccount[];
  /** Called after a successful Save (not Save & New) — id is the created/edited account's id. */
  onSaved?: (id: string) => void;
  /** 'sheet' (default, unchanged) renders the existing tabbed side-panel. 'page' renders the exact
   *  same fields/state/save logic as stacked full-page boxes (QuoteForm visual vocabulary) instead —
   *  used only by AccountDetail.tsx's inline Edit mode. Firebase read/write and validation are
   *  100% shared between both render modes; only the JSX wrapper differs. */
  renderAs?: "sheet" | "page";
  /** 'page' mode only — called when the user wants to leave edit mode without a dedicated Sheet
   *  close affordance (the page's own "Back"/"Done" action clears this instead). */
  onCancel?: () => void;
}

/** Shared value/onChange wiring for every field, rendered by both the tabbed Sheet ('dense=false')
 *  and the stacked full-page boxes ('dense=true') layouts below — only the wrapping grid/label/
 *  input styling differs per layout, so a field addition or validation tweak only has to be made
 *  once here instead of independently in two ~200-line JSX blocks. */
interface FieldsProps {
  form: CrmAccountInput;
  set: <K extends keyof CrmAccountInput>(
    key: K,
    value: CrmAccountInput[K],
  ) => void;
  dense: boolean;
  // Only CompanyInfoFields actually reads this (as the "owner" input's placeholder) — optional so
  // the type doesn't imply every field group depends on the current user when ContactFields,
  // AddressFieldGroup, and BusinessProfileFields never read it despite receiving it as a prop.
  currentUser?: string;
}

function CompanyInfoFields({ form, set, dense, currentUser }: FieldsProps) {
  const labelClass = dense ? "text-black" : undefined;
  const inputClass = dense ? "h-9 rounded-xl" : undefined;
  return (
    <>
      <div
        className={cn(dense ? "md:col-span-2" : "col-span-2", "space-y-1.5")}
      >
        <Label className={labelClass}>
          Account Name <span className="text-red-500">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Acme Textiles Pvt Ltd"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Account Type</Label>
        <Select
          value={form.accountType || "Prospect"}
          onValueChange={(v) =>
            set("accountType", v as CrmAccountInput["accountType"])
          }
        >
          <SelectTrigger className={inputClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              ["Prospect", "Customer", "Partner", "Vendor", "Reseller"] as const
            ).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Owner (Salesperson)</Label>
        <Input
          value={form.ownerName}
          onChange={(e) => set("ownerName", e.target.value)}
          placeholder={currentUser}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Industry</Label>
        <Input
          value={form.industry}
          onChange={(e) => set("industry", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Website</Label>
        <Input
          type="url"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder="https://example.com"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Company Registration / Reference</Label>
        <Input
          value={form.registrationNumber}
          onChange={(e) => set("registrationNumber", e.target.value)}
          placeholder="GSTIN / CIN / Reg. No."
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Number of Employees</Label>
        <Input
          type="number"
          min={0}
          value={form.numberOfEmployees ?? ""}
          onChange={(e) =>
            set(
              "numberOfEmployees",
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Annual Revenue (₹)</Label>
        <Input
          type="number"
          min={0}
          value={form.annualRevenue ?? ""}
          onChange={(e) =>
            set(
              "annualRevenue",
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
          className={inputClass}
        />
      </div>
      <div
        className={cn(dense ? "md:col-span-3" : "col-span-2", "space-y-1.5")}
      >
        <Label className={labelClass}>Description</Label>
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What this company does, how we work with them, etc."
          className={dense ? "rounded-xl" : undefined}
        />
      </div>
    </>
  );
}

function ContactFields({ form, set, dense }: FieldsProps) {
  const labelClass = dense ? "text-black" : undefined;
  const inputClass = dense ? "h-9 rounded-xl" : undefined;
  return (
    <>
      <div className="space-y-1.5">
        <Label className={labelClass}>Phone</Label>
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputClass}
        />
      </div>
      {dense && (
        <div className="space-y-1.5">
          <Label className={labelClass}>HQ / City</Label>
          <Input
            value={form.hq}
            onChange={(e) => set("hq", e.target.value)}
            placeholder="e.g. Mumbai, India"
            className={inputClass}
          />
        </div>
      )}
      <div
        className={cn(dense ? "md:col-span-3" : "col-span-2", "space-y-1.5")}
      >
        <Label className={labelClass}>LinkedIn</Label>
        <Input
          type="url"
          value={form.linkedin}
          onChange={(e) => set("linkedin", e.target.value)}
          placeholder="https://linkedin.com/company/…"
          className={inputClass}
        />
      </div>
      {!dense && (
        <div className="col-span-2 space-y-1.5">
          <Label>HQ / City</Label>
          <Input
            value={form.hq}
            onChange={(e) => set("hq", e.target.value)}
            placeholder="e.g. Mumbai, India"
          />
        </div>
      )}
    </>
  );
}

/** One address's Street/City/State/Postal Code/Country fields — `prefix` selects billing vs
 *  shipping on the shared `CrmAccountInput` shape (`${prefix}Street`, `${prefix}City`, ...). The
 *  two layouts' visual chrome (bordered box vs plain section, placeholder-only vs `<Label>`)
 *  differs enough to keep as two small branches, but the field key -> value/onChange wiring —
 *  the part a typo or a missed field would actually break — is written exactly once. */
function AddressFieldGroup({
  form,
  set,
  dense,
  prefix,
}: FieldsProps & { prefix: "billing" | "shipping" }) {
  const streetKey = `${prefix}Street` as const;
  const cityKey = `${prefix}City` as const;
  const stateKey = `${prefix}State` as const;
  const postalKey = `${prefix}PostalCode` as const;
  const countryKey = `${prefix}Country` as const;

  if (dense) {
    return (
      <>
        <Input
          placeholder="Street"
          value={form[streetKey]}
          onChange={(e) => set(streetKey, e.target.value)}
          className="h-9 rounded-xl"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="City"
            value={form[cityKey]}
            onChange={(e) => set(cityKey, e.target.value)}
            className="h-9 rounded-xl"
          />
          <Input
            placeholder="State/Province"
            value={form[stateKey]}
            onChange={(e) => set(stateKey, e.target.value)}
            className="h-9 rounded-xl"
          />
          <Input
            placeholder="Postal Code"
            value={form[postalKey]}
            onChange={(e) => set(postalKey, e.target.value)}
            className="h-9 rounded-xl"
          />
          <Input
            placeholder="Country"
            value={form[countryKey]}
            onChange={(e) => set(countryKey, e.target.value)}
            className="h-9 rounded-xl"
          />
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
      <div className="col-span-2 space-y-1.5">
        <Label>Street</Label>
        <Input
          value={form[streetKey]}
          onChange={(e) => set(streetKey, e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>City</Label>
        <Input
          value={form[cityKey]}
          onChange={(e) => set(cityKey, e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>State / Province</Label>
        <Input
          value={form[stateKey]}
          onChange={(e) => set(stateKey, e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Postal Code</Label>
        <Input
          value={form[postalKey]}
          onChange={(e) => set(postalKey, e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Input
          value={form[countryKey]}
          onChange={(e) => set(countryKey, e.target.value)}
        />
      </div>
    </div>
  );
}

function BusinessProfileFields({ form, set, dense }: FieldsProps) {
  const labelClass = dense ? "text-black" : undefined;
  const inputClass = dense ? "h-9 rounded-xl" : undefined;
  return (
    <>
      <div className="space-y-1.5">
        <Label className={labelClass}>Customer Category</Label>
        <Select
          value={form.customerCategory || ""}
          onValueChange={(v) =>
            set("customerCategory", v as CrmAccountInput["customerCategory"])
          }
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {(["Enterprise", "Mid-Market", "SMB", "Individual"] as const).map(
              (c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Customer Class</Label>
        <Select
          value={form.customerClass || ""}
          onValueChange={(v) =>
            set("customerClass", v as CrmAccountInput["customerClass"])
          }
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {(["A", "B", "C"] as const).map((c) => (
              <SelectItem key={c} value={c}>
                Class {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Business Type</Label>
        <Select
          value={form.businessType || ""}
          onValueChange={(v) =>
            set("businessType", v as CrmAccountInput["businessType"])
          }
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                "Manufacturer",
                "Distributor",
                "Retailer",
                "Service Provider",
                "Reseller",
                "Other",
              ] as const
            ).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Reseller / Customer Type</Label>
        <Input
          value={form.resellerType}
          onChange={(e) => set("resellerType", e.target.value)}
          placeholder="e.g. Channel Partner"
          className={inputClass}
        />
      </div>
    </>
  );
}

/** Fields Bulk Import discovered from an unmatched Excel header with no built-in Account field —
 *  see `../bulkImport/crmCustomFieldsService.ts`. Rendered as plain text inputs, same styling as
 *  every other field group above, nested under `form.customFields` instead of a top-level key. */
function CustomFieldsFields({
  form,
  set,
  dense,
  defs,
}: FieldsProps & { defs: CrmCustomFieldDef[] }) {
  const labelClass = dense ? "text-black" : undefined;
  const inputClass = dense ? "h-9 rounded-xl" : undefined;
  return (
    <>
      {defs.map((d) => (
        <div key={d.key} className="space-y-1.5">
          <Label className={labelClass}>{d.label}</Label>
          <Input
            value={form.customFields?.[d.key] || ""}
            onChange={(e) =>
              set("customFields", {
                ...form.customFields,
                [d.key]: e.target.value,
              })
            }
            className={inputClass}
          />
        </div>
      ))}
    </>
  );
}

export function AccountFormDialog({
  open,
  onOpenChange,
  mode,
  account,
  currentUser,
  existingAccounts,
  onSaved,
  renderAs = "sheet",
  onCancel,
}: AccountFormDialogProps) {
  const customFieldDefs = useCrmCustomFields("accounts");
  const [form, setForm] = useState<CrmAccountInput>(() =>
    mode === "edit" && account ? toForm(account) : emptyForm(currentUser),
  );
  const [tagsDraft, setTagsDraft] = useState("");
  const [tab, setTab] = useState("company");
  const [saving, setSaving] = useState<"save" | "saveNew" | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<CrmAccount | null>(
    null,
  );
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      mode === "edit" && account ? toForm(account) : emptyForm(currentUser),
    );
    setTagsDraft(
      mode === "edit" && account?.tags ? account.tags.join(", ") : "",
    );
    setTab("company");
    setDuplicateWarning(null);
    setConfirmedDuplicate(false);
  }, [open, mode, account, currentUser]);

  const set = <K extends keyof CrmAccountInput>(
    key: K,
    value: CrmAccountInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const copyBillingToShipping = () => {
    setForm((f) => ({
      ...f,
      shippingStreet: f.billingStreet,
      shippingCity: f.billingCity,
      shippingState: f.billingState,
      shippingPostalCode: f.billingPostalCode,
      shippingCountry: f.billingCountry,
    }));
  };

  const buildPayload = (): CrmAccountInput => ({
    ...form,
    ownerName: form.ownerName || currentUser,
    createdBy: mode === "create" ? currentUser : form.createdBy,
    tags: tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  const save = async (andNew: boolean) => {
    if (!form.name.trim()) return;

    if (mode === "create" && !confirmedDuplicate && existingAccounts?.length) {
      const dup = findPossibleDuplicateAccount(existingAccounts, {
        name: form.name,
        website: form.website,
        email: form.email,
      });
      if (dup) {
        setDuplicateWarning(dup);
        return;
      }
    }

    setSaving(andNew ? "saveNew" : "save");
    try {
      const payload = buildPayload();
      if (mode === "edit" && account) {
        await updateCrmAccount(account.id, payload, currentUser, account);
        toast.success("Account updated");
        celebrateCrm("account.updated");
        onOpenChange(false);
        onSaved?.(account.id);
      } else {
        const id = await createCrmAccount(payload);
        toast.success("Account created");
        celebrateCrm("account.created");
        if (andNew) {
          setForm(emptyForm(currentUser));
          setTagsDraft("");
          setTab("company");
          setDuplicateWarning(null);
          setConfirmedDuplicate(false);
        } else {
          onOpenChange(false);
          onSaved?.(id);
        }
      }
    } catch (err) {
      console.error(
        `Failed to ${mode === "edit" ? "update" : "create"} account:`,
        err,
      );
      toast.error(
        `Failed to ${mode === "edit" ? "update" : "create"} account. Please try again.`,
      );
    } finally {
      setSaving(null);
    }
  };

  const busy = saving !== null;

  if (renderAs === "page") {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-black">
                {mode === "edit" ? "Edit Account" : "Add Account"}
              </h2>
              <p className="text-sm text-slate-400">
                {account?.name || "Update this account’s details below."}
              </p>
            </div>
          </div>
        </div>

        {duplicateWarning && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-bold">
                This looks like an existing account: "{duplicateWarning.name}"
              </p>
              <p className="mt-0.5 text-amber-700">
                Consider linking to that account instead of creating a
                duplicate.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg text-xs border-amber-300 bg-white"
                  onClick={() => {
                    setConfirmedDuplicate(true);
                    setDuplicateWarning(null);
                  }}
                >
                  Create anyway
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg text-xs text-amber-700"
                  onClick={() => setDuplicateWarning(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Company Information */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <Building2 className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">
              Company Information
            </h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <CompanyInfoFields
              form={form}
              set={set}
              dense
              currentUser={currentUser}
            />
          </div>
        </div>

        {/* Contact Details */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <Contact className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Contact Details</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <ContactFields
              form={form}
              set={set}
              dense
              currentUser={currentUser}
            />
          </div>
        </div>

        {/* Address */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <MapPin className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Address</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-black">
                Billing Address
              </p>
              <AddressFieldGroup
                form={form}
                set={set}
                dense
                currentUser={currentUser}
                prefix="billing"
              />
            </div>
            <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wide text-black">
                  Shipping Address
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs rounded-lg gap-1"
                  onClick={copyBillingToShipping}
                >
                  <Copy className="h-3 w-3" /> Copy Billing
                </Button>
              </div>
              <AddressFieldGroup
                form={form}
                set={set}
                dense
                currentUser={currentUser}
                prefix="shipping"
              />
            </div>
          </div>
        </div>

        {/* Business Profile */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <Briefcase className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Business Profile</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <BusinessProfileFields
              form={form}
              set={set}
              dense
              currentUser={currentUser}
            />
          </div>
        </div>

        {/* Additional Information */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <FileText className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">
              Additional Information
            </h3>
          </div>
          <div className="space-y-1.5">
            <Label className="text-black">Tags</Label>
            <Input
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              placeholder="Comma-separated, e.g. VIP, Renewal Q4, Key Account"
              className="h-9 rounded-xl"
            />
            <p className="text-sm text-black">
              Separate multiple tags with commas.
            </p>
          </div>
          {customFieldDefs.length > 0 && (
            <div className="grid md:grid-cols-3 gap-3 pt-2">
              <CustomFieldsFields
                form={form}
                set={set}
                dense
                defs={customFieldDefs}
              />
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            {mode === "edit"
              ? "Editing an existing account."
              : "Fill in the fields above and save."}
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onCancel?.();
              }}
            >
              Cancel
            </Button>
            {mode === "create" && (
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={!form.name.trim() || busy}
                onClick={() => save(true)}
              >
                {saving === "saveNew" ? "Saving…" : "Save & New"}
              </Button>
            )}
            <Button
              className="rounded-xl font-bold"
              disabled={!form.name.trim() || busy}
              onClick={() => save(false)}
            >
              {saving === "save"
                ? "Saving…"
                : mode === "edit"
                  ? "Save Changes"
                  : "Create Account"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      {/* A pre-existing global rule (src/index.css) forces `[role="dialog"] { max-width: 95vw !important; }`
          on every Radix dialog/sheet in the app, which silently defeats a `max-w-*` utility here.
          Setting an explicit `width` instead sidesteps that rule without touching the global file. */}
      <SheetContent
        side="right"
        className="w-full sm:w-[44rem] rounded-l-3xl flex flex-col gap-0 p-0 shadow-2xl border-l border-slate-200"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-slate-900">
            <Building2 className="h-4 w-4 text-brand-600" />{" "}
            {mode === "edit" ? "Edit Account" : "Add Account"}
          </SheetTitle>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 flex flex-wrap gap-2">
            {FORM_TABS.map((t) => {
              const isActive = t.id === tab;
              const Icon = t.icon;
              const tone = TAB_TONE_STYLE[t.tone];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all duration-150 ease-out",
                    isActive
                      ? "shadow-sm border-brand-400 bg-brand-50 ring-1 ring-brand-200"
                      : cn(
                          tone.border,
                          tone.bgSubtle,
                          "hover:border-slate-300",
                        ),
                  )}
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      tone.iconBg,
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", tone.iconColor)} />
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold whitespace-nowrap",
                      isActive ? "text-brand-700" : "text-slate-600",
                    )}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {/* Company Information */}
            <TabsContent value="company" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-brand-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-brand-600" /> Company
                  Information
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <CompanyInfoFields
                  form={form}
                  set={set}
                  dense={false}
                  currentUser={currentUser}
                />
              </div>
            </TabsContent>

            {/* Contact & Communication */}
            <TabsContent value="contact" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-blue-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Contact className="h-4 w-4 text-blue-600" /> Contact Details
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <ContactFields
                  form={form}
                  set={set}
                  dense={false}
                  currentUser={currentUser}
                />
              </div>
            </TabsContent>

            {/* Address */}
            <TabsContent value="address" className="mt-0 space-y-5">
              <div className="mb-4 pb-2 border-b-2 border-purple-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-purple-600" /> Address
                </h3>
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-purple-700 mb-2 pb-1 border-b border-purple-100">
                  Billing Address
                </p>
                <AddressFieldGroup
                  form={form}
                  set={set}
                  dense={false}
                  currentUser={currentUser}
                  prefix="billing"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-purple-100">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-purple-700">
                    Shipping Address
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs rounded-lg gap-1 text-slate-600"
                    onClick={copyBillingToShipping}
                  >
                    <Copy className="h-3 w-3" /> Same as billing
                  </Button>
                </div>
                <AddressFieldGroup
                  form={form}
                  set={set}
                  dense={false}
                  currentUser={currentUser}
                  prefix="shipping"
                />
              </div>
            </TabsContent>

            {/* Business Profile */}
            <TabsContent value="profile" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-amber-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-amber-600" /> Business
                  Profile
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <BusinessProfileFields
                  form={form}
                  set={set}
                  dense={false}
                  currentUser={currentUser}
                />
              </div>
            </TabsContent>

            {/* Additional Information */}
            <TabsContent value="more" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-teal-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-teal-600" /> Additional
                  Information
                </h3>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  placeholder="Comma-separated, e.g. VIP, Renewal Q4, Key Account"
                />
                <p className="text-sm text-slate-400">
                  Separate multiple tags with commas.
                </p>
              </div>
              {customFieldDefs.length > 0 && (
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 mt-4 pt-4 border-t border-slate-100">
                  <CustomFieldsFields
                    form={form}
                    set={set}
                    dense={false}
                    defs={customFieldDefs}
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {duplicateWarning && (
          <div className="mx-6 mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-bold">
                This looks like an existing account: "{duplicateWarning.name}"
              </p>
              <p className="mt-0.5 text-amber-700">
                Consider linking to that account instead of creating a
                duplicate.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg text-xs border-amber-300 bg-white"
                  onClick={() => {
                    setConfirmedDuplicate(true);
                    setDuplicateWarning(null);
                  }}
                >
                  Create anyway
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg text-xs text-amber-700"
                  onClick={() => setDuplicateWarning(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <SheetFooter className="gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 sm:justify-end">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          {mode === "create" && (
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!form.name.trim() || busy}
              onClick={() => save(true)}
            >
              {saving === "saveNew" ? "Saving…" : "Save & New"}
            </Button>
          )}
          <Button
            className="rounded-xl font-bold shadow-sm shadow-brand-600/20"
            disabled={!form.name.trim() || busy}
            onClick={() => save(false)}
          >
            {saving === "save"
              ? "Saving…"
              : mode === "edit"
                ? "Save Changes"
                : "Create Account"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
