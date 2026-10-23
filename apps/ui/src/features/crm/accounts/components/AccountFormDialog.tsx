"use client";

// Account create/edit form — port of legacy `domain/AccountFormDialog.tsx`. A single reusable,
// tabbed side-sheet used by "Add Account" (list) and, in `renderAs="page"` mode (stacked
// full-page boxes), by the Account detail page's inline Edit mode and /crm/accounts/new.
import type { Account, CrmCustomFieldDef } from "@texawave-erp/api-types";
import {
  ACCOUNT_TYPES,
  BUSINESS_TYPES,
  createAccountSchema,
  CUSTOMER_CATEGORIES,
  CUSTOMER_CLASSES,
} from "@texawave-erp/core";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Contact,
  Copy,
  FileText,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/legacy-ui/sheet";
import { Tabs, TabsContent } from "@/components/legacy-ui/tabs";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { useCustomFields } from "@/features/crm/bulk-import/hooks";
import { celebrateCrm } from "@/features/crm/celebration";
import { listAccounts } from "../api";
import { useCreateAccount, useUpdateAccount } from "../hooks";
import { CANCEL_BTN_CLASS } from "./accountUi";

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
  {
    id: "more",
    label: "Additional Information",
    icon: FileText,
    tone: "teal",
  },
] as const;

type TabTone = (typeof FORM_TABS)[number]["tone"];

const TAB_TONE_STYLE: Record<
  TabTone,
  { border: string; bgSubtle: string; iconBg: string; iconColor: string }
> = {
  brand: {
    border: "border-brand-200",
    bgSubtle: "bg-brand-50/50",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-600",
  },
  blue: {
    border: "border-blue-200",
    bgSubtle: "bg-blue-50/50",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  purple: {
    border: "border-purple-200",
    bgSubtle: "bg-purple-50/50",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  amber: {
    border: "border-amber-200",
    bgSubtle: "bg-amber-50/50",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  teal: {
    border: "border-teal-200",
    bgSubtle: "bg-teal-50/50",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
};

interface FormState {
  name: string;
  accountType: string;
  ownerName: string;
  industry: string;
  hq: string;
  website: string;
  phone: string;
  email: string;
  linkedin: string;
  registrationNumber: string;
  numberOfEmployees: string;
  annualRevenue: string;
  description: string;
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  customerCategory: string;
  customerClass: string;
  businessType: string;
  resellerType: string;
  customFields: Record<string, string>;
}

const emptyForm = (): FormState => ({
  name: "",
  accountType: "Prospect",
  ownerName: "",
  industry: "",
  hq: "",
  website: "",
  phone: "",
  email: "",
  linkedin: "",
  registrationNumber: "",
  numberOfEmployees: "",
  annualRevenue: "",
  description: "",
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
  customerCategory: "",
  customerClass: "",
  businessType: "",
  resellerType: "",
  customFields: {},
});

function toForm(a: Account): FormState {
  return {
    name: a.name,
    accountType: a.accountType ?? "Prospect",
    ownerName: a.ownerName ?? "",
    industry: a.industry ?? "",
    hq: a.hq ?? "",
    website: a.website ?? "",
    phone: a.phone ?? "",
    email: a.email ?? "",
    linkedin: a.linkedin ?? "",
    registrationNumber: a.registrationNumber ?? "",
    numberOfEmployees: a.numberOfEmployees?.toString() ?? "",
    annualRevenue: a.annualRevenue ? String(Number(a.annualRevenue)) : "",
    description: a.description ?? "",
    billingStreet: a.billingStreet ?? "",
    billingCity: a.billingCity ?? "",
    billingState: a.billingState ?? "",
    billingPostalCode: a.billingPostalCode ?? "",
    billingCountry: a.billingCountry ?? "",
    shippingStreet: a.shippingStreet ?? "",
    shippingCity: a.shippingCity ?? "",
    shippingState: a.shippingState ?? "",
    shippingPostalCode: a.shippingPostalCode ?? "",
    shippingCountry: a.shippingCountry ?? "",
    customerCategory: a.customerCategory ?? "",
    customerClass: a.customerClass ?? "",
    businessType: a.businessType ?? "",
    resellerType: a.resellerType ?? "",
    customFields: { ...(a.customFields ?? {}) },
  };
}

interface FieldsProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  dense: boolean;
  currentUser?: string | undefined;
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
          onValueChange={(v) => set("accountType", v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => (
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
          value={form.numberOfEmployees}
          onChange={(e) => set("numberOfEmployees", e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Annual Revenue (₹)</Label>
        <Input
          type="number"
          min={0}
          value={form.annualRevenue}
          onChange={(e) => set("annualRevenue", e.target.value)}
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

/** Fields Bulk Import discovered from an unmatched Excel header with no built-in Account field
 * (GET /crm/custom-fields?module=accounts) — plain text inputs nested under customFields. */
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
            value={form.customFields[d.key] ?? ""}
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
          value={form.customerCategory}
          onValueChange={(v) => set("customerCategory", v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Customer Class</Label>
        <Select
          value={form.customerClass}
          onValueChange={(v) => set("customerClass", v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_CLASSES.map((c) => (
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
          value={form.businessType}
          onValueChange={(v) => set("businessType", v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map((t) => (
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

const norm = (s?: string | null) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const domainOf = (s?: string | null) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? "";

/** Port of legacy `findPossibleDuplicateAccount`, run against server search results. */
async function findPossibleDuplicate(candidate: {
  name: string;
  website: string;
  email: string;
}): Promise<Account | undefined> {
  const name = norm(candidate.name);
  const domain = domainOf(candidate.website);
  const email = candidate.email.trim().toLowerCase();
  const emailDomain = email.includes("@") ? (email.split("@")[1] ?? "") : "";
  if (!name && !domain && !emailDomain) return undefined;

  const terms = [candidate.name.trim(), domain, emailDomain].filter(Boolean);
  const results = await Promise.all(
    terms.map((search) => listAccounts({ search, limit: 25 })),
  );
  const all = results.flatMap((r) => r.data);
  return all.find((a) => {
    if (name && norm(a.name) === name) return true;
    if (domain && domainOf(a.website) === domain) return true;
    if (
      emailDomain &&
      (a.email || "").split("@")[1]?.toLowerCase() === emailDomain
    )
      return true;
    return false;
  });
}

export interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  account?: Account | undefined;
  currentUser?: string | undefined;
  /** Called after a successful Save (not Save & New) — id is the created/edited account's id. */
  onSaved?: ((id: number) => void) | undefined;
  /** 'sheet' (default) renders the tabbed side-panel; 'page' renders the same fields as
   *  stacked full-page boxes. */
  renderAs?: "sheet" | "page";
  onCancel?: (() => void) | undefined;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  mode,
  account,
  currentUser,
  onSaved,
  renderAs = "sheet",
  onCancel,
}: AccountFormDialogProps) {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const customFieldDefs = useCustomFields("accounts").data ?? [];
  const [form, setForm] = useState<FormState>(() =>
    mode === "edit" && account ? toForm(account) : emptyForm(),
  );
  const [tagsDraft, setTagsDraft] = useState("");
  const [tab, setTab] = useState("company");
  const [saving, setSaving] = useState<"save" | "saveNew" | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Account | null>(
    null,
  );
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  // Re-seed the form whenever the dialog (re)opens or a different/updated account is edited
  // (adjust-state-during-render, no effect).
  const resetKey = open
    ? `${mode}:${account?.id ?? "new"}:${account?.updatedAt ?? ""}`
    : "closed";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setForm(mode === "edit" && account ? toForm(account) : emptyForm());
      setTagsDraft(
        mode === "edit" && account?.tags ? account.tags.join(", ") : "",
      );
      setTab("company");
      setDuplicateWarning(null);
      setConfirmedDuplicate(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  const buildRaw = () => {
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    return {
      name: form.name,
      accountType: opt(form.accountType),
      ownerName: opt(form.ownerName) ?? currentUser,
      industry: opt(form.industry),
      hq: opt(form.hq),
      website: opt(form.website),
      phone: opt(form.phone),
      email: opt(form.email),
      linkedin: opt(form.linkedin),
      registrationNumber: opt(form.registrationNumber),
      numberOfEmployees: form.numberOfEmployees
        ? Number(form.numberOfEmployees)
        : undefined,
      annualRevenue: form.annualRevenue
        ? Number(form.annualRevenue)
        : undefined,
      description: opt(form.description),
      billingStreet: opt(form.billingStreet),
      billingCity: opt(form.billingCity),
      billingState: opt(form.billingState),
      billingPostalCode: opt(form.billingPostalCode),
      billingCountry: opt(form.billingCountry),
      shippingStreet: opt(form.shippingStreet),
      shippingCity: opt(form.shippingCity),
      shippingState: opt(form.shippingState),
      shippingPostalCode: opt(form.shippingPostalCode),
      shippingCountry: opt(form.shippingCountry),
      customerCategory: opt(form.customerCategory),
      customerClass: opt(form.customerClass),
      businessType: opt(form.businessType),
      resellerType: opt(form.resellerType),
      tags: tagsDraft
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      customFields: Object.fromEntries(
        customFieldDefs.map((d) => [
          d.key,
          (form.customFields[d.key] ?? "").trim(),
        ]),
      ),
    };
  };

  const save = async (andNew: boolean) => {
    if (!form.name.trim()) return;

    const parsed = createAccountSchema.safeParse(buildRaw());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form fields");
      return;
    }

    if (mode === "create" && !confirmedDuplicate) {
      try {
        const dup = await findPossibleDuplicate({
          name: form.name,
          website: form.website,
          email: form.email,
        });
        if (dup) {
          setDuplicateWarning(dup);
          return;
        }
      } catch {
        // Duplicate check is advisory — never block saving on a lookup failure.
      }
    }

    setSaving(andNew ? "saveNew" : "save");
    try {
      if (mode === "edit" && account) {
        await updateMutation.mutateAsync({
          id: account.id,
          input: parsed.data,
        });
        toast.success("Account updated");
        celebrateCrm("account.updated");
        onOpenChange(false);
        onSaved?.(account.id);
      } else {
        const created = await createMutation.mutateAsync(parsed.data);
        toast.success("Account created");
        celebrateCrm("account.created");
        if (andNew) {
          setForm(emptyForm());
          setTagsDraft("");
          setTab("company");
          setDuplicateWarning(null);
          setConfirmedDuplicate(false);
        } else {
          onOpenChange(false);
          onSaved?.(created.id);
        }
      }
    } catch {
      toast.error(
        `Failed to ${mode === "edit" ? "update" : "create"} account. Please try again.`,
      );
    } finally {
      setSaving(null);
    }
  };

  const busy = saving !== null;

  const duplicateBanner = duplicateWarning ? (
    <div
      className={cn(
        "flex items-start gap-2 border border-amber-200 bg-amber-50 text-sm text-amber-800",
        renderAs === "page"
          ? "rounded-3xl p-4"
          : "mx-6 mb-3 rounded-xl px-3 py-2.5",
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
      <div className="flex-1">
        <p className="font-bold">
          This looks like an existing account: &quot;{duplicateWarning.name}
          &quot;
        </p>
        <p className="mt-0.5 text-amber-700">
          Consider linking to that account instead of creating a duplicate.
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
  ) : null;

  if (renderAs === "page") {
    const box =
      "rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4";
    const chip =
      "p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200";
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

        {duplicateBanner}

        <div className={box}>
          <div className="flex items-center gap-2.5">
            <span className={chip}>
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

        <div className={box}>
          <div className="flex items-center gap-2.5">
            <span className={chip}>
              <Contact className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Contact Details</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <ContactFields form={form} set={set} dense />
          </div>
        </div>

        <div className={box}>
          <div className="flex items-center gap-2.5">
            <span className={chip}>
              <MapPin className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Address</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-black">
                Billing Address
              </p>
              <AddressFieldGroup form={form} set={set} dense prefix="billing" />
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
                prefix="shipping"
              />
            </div>
          </div>
        </div>

        <div className={box}>
          <div className="flex items-center gap-2.5">
            <span className={chip}>
              <Briefcase className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-black">Business Profile</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <BusinessProfileFields form={form} set={set} dense />
          </div>
        </div>

        <div className={box}>
          <div className="flex items-center gap-2.5">
            <span className={chip}>
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

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-400">
            {mode === "edit"
              ? "Editing an existing account."
              : "Fill in the fields above and save."}
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              className={CANCEL_BTN_CLASS}
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
                onClick={() => void save(true)}
              >
                {saving === "saveNew" ? "Saving…" : "Save & New"}
              </Button>
            )}
            <Button
              className="rounded-xl font-bold"
              disabled={!form.name.trim() || busy}
              onClick={() => void save(false)}
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

            <TabsContent value="contact" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-blue-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Contact className="h-4 w-4 text-blue-600" /> Contact Details
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <ContactFields form={form} set={set} dense={false} />
              </div>
            </TabsContent>

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
                  prefix="shipping"
                />
              </div>
            </TabsContent>

            <TabsContent value="profile" className="mt-0">
              <div className="mb-4 pb-2 border-b-2 border-amber-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-amber-600" /> Business
                  Profile
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <BusinessProfileFields form={form} set={set} dense={false} />
              </div>
            </TabsContent>

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

        {duplicateBanner}

        <SheetFooter className="gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 sm:justify-end">
          <Button
            variant="outline"
            className={CANCEL_BTN_CLASS}
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
              onClick={() => void save(true)}
            >
              {saving === "saveNew" ? "Saving…" : "Save & New"}
            </Button>
          )}
          <Button
            className="rounded-xl font-bold shadow-sm shadow-brand-600/20"
            disabled={!form.name.trim() || busy}
            onClick={() => void save(false)}
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
