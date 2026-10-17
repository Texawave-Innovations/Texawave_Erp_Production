"use client";

import type {
  Product,
  Quotation,
  QuotationStatus,
} from "@texawave-erp/api-types";
import {
  ApiError,
  QUOTATION_STATUSES,
  quotationPayloadSchema,
} from "@texawave-erp/core";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Calendar } from "@/components/legacy-ui/calendar";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/legacy-ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { Textarea } from "@/components/legacy-ui/textarea";
import { cn } from "@/components/legacy-ui/utils";
import { celebrateCrm } from "@/features/crm/celebration";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  QUOTATION_STATUS_STYLE,
  currencySymbol,
  formatMoney,
} from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Copy,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Printer,
  Receipt,
  Save,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccounts } from "../../accounts/hooks";
import { useContacts } from "../../contacts/hooks";
import { useOpportunities } from "../../opportunities/hooks";
import {
  useCreateQuotation,
  useDeleteQuotation,
  useReplaceQuotation,
} from "../hooks";
import { printQuotation } from "../print/printQuotation";
import { AsyncPicker } from "@/features/crm/legacy-ui/AsyncPicker";
import { QuoteProductPicker } from "./QuoteProductPicker";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

interface DraftLine {
  key: string;
  /** Display name of the picked product (the picker is server-searched). */
  productLabel?: string | undefined;
  productId?: number | undefined;
  productCode?: string | undefined;
  description: string;
  uom: string;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

function emptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    uom: "",
    quantity: 1,
    listPrice: 0,
    unitPrice: 0,
    discountPercent: 0,
    taxPercent: 0,
  };
}

function computeLine(
  line: Pick<
    DraftLine,
    "quantity" | "unitPrice" | "discountPercent" | "taxPercent"
  >,
) {
  const gross = round2(line.quantity * line.unitPrice);
  const discountAmount = round2(gross * (line.discountPercent / 100));
  const taxableAmount = round2(gross - discountAmount);
  const taxAmount = round2(taxableAmount * (line.taxPercent / 100));
  const total = round2(taxableAmount + taxAmount);
  return { gross, discountAmount, taxAmount, total };
}

/** Client-side preview only — the server is the sole source of truth
 * for every persisted total (approved decision D4,
 * Docs/CRM_QUOTES_LEGACY_PARITY.md §2.3/§6). This mirrors
 * apps/api/src/modules/crm/shared/money.ts's `round2` so the live
 * preview matches what the server will compute, but nothing here is
 * ever submitted as a total. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Parses 'YYYY-MM-DD' into a local Date (avoids the UTC shift of new Date(str)). */
function fromIsoDateStr(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toIsoDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface QuotationFormProps {
  existing?: Quotation | undefined;
  initialAccountId?: number | undefined;
  initialOpportunityId?: number | undefined;
}

/**
 * Reproduces legacy QuoteForm.tsx: one screen for create, edit, AND view
 * (legacy has no separate read-only route either —
 * Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1). Billing/Shipping + "Copy
 * Billing to Shipping", Terms & Conditions, a freely-editable Status
 * dropdown with no transition guard, and the three save actions (Save
 * Draft / Save/Create / Save & New). `unitPrice` stays editable after a
 * product pick — the one deliberate divergence from
 * `OpportunityProduct`'s frozen-price model (§1.3/§5 of the audit).
 * Print / Save-as-PDF (Docs/CRM_QUOTES_PRINT_PARITY.md) opens a
 * browser-native print popup built from the already-saved, server-
 * computed quotation — only enabled once the quote has been saved at
 * least once (no client-side preview of the server-computed number/
 * totals is shown before that).
 */
export function QuotationForm({
  existing,
  initialAccountId,
  initialOpportunityId,
}: QuotationFormProps) {
  const router = useRouter();
  const currentUser = useAuthStore((st) => st.user?.fullName ?? "");
  const canDelete = usePermission("crm.quotation.delete");
  const deleteMutation = useDeleteQuotation();
  const isEdit = Boolean(existing);

  const [accountId, setAccountId] = useState<number | undefined>(
    existing?.accountId ?? initialAccountId,
  );
  const [opportunityId, setOpportunityId] = useState<number | undefined>(
    existing?.opportunityId ?? initialOpportunityId ?? undefined,
  );
  const [contactId, setContactId] = useState<number | undefined>(
    existing?.contactId ?? undefined,
  );
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [status, setStatus] = useState<QuotationStatus>(
    existing?.status ?? "Draft",
  );
  const [quoteOwner, setQuoteOwner] = useState(
    existing?.quoteOwner ?? currentUser,
  );
  const [currency, setCurrency] = useState(existing?.currency ?? "INR");
  const [quoteDate, setQuoteDate] = useState(
    existing?.quoteDate?.slice(0, 10) ?? todayISO(),
  );
  const [validUntil, setValidUntil] = useState(
    existing?.validUntil?.slice(0, 10) ?? addDaysISO(todayISO(), 30),
  );
  const [customerReference, setCustomerReference] = useState(
    existing?.customerReference ?? "",
  );
  const [billing, setBilling] = useState({
    street: existing?.billingStreet ?? "",
    city: existing?.billingCity ?? "",
    state: existing?.billingState ?? "",
    postalCode: existing?.billingPostalCode ?? "",
    country: existing?.billingCountry ?? "",
  });
  const [shipping, setShipping] = useState({
    street: existing?.shippingStreet ?? "",
    city: existing?.shippingCity ?? "",
    state: existing?.shippingState ?? "",
    postalCode: existing?.shippingPostalCode ?? "",
    country: existing?.shippingCountry ?? "",
  });
  const [carrier, setCarrier] = useState(existing?.carrier ?? "");
  const [deliveryNotes, setDeliveryNotes] = useState(
    existing?.deliveryNotes ?? "",
  );
  const [termsConditions, setTermsConditions] = useState(
    existing?.termsConditions ?? "",
  );
  const [paymentTerms, setPaymentTerms] = useState(
    existing?.paymentTerms ?? "",
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    existing?.deliveryTerms ?? "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [adjustment, setAdjustment] = useState(
    existing ? Number(existing.adjustment) : 0,
  );
  const [lines, setLines] = useState<DraftLine[]>(
    existing && existing.lineItems.length > 0
      ? existing.lineItems.map((item) => ({
          key: String(item.id),
          productId: item.productId ?? undefined,
          productCode: item.productCode ?? undefined,
          productLabel: item.description,
          description: item.description,
          uom: item.uom ?? "",
          quantity: Number(item.quantity),
          listPrice: Number(item.listPrice),
          unitPrice: Number(item.unitPrice),
          discountPercent: item.discountPercent
            ? Number(item.discountPercent)
            : 0,
          taxPercent: item.taxPercent ? Number(item.taxPercent) : 0,
        }))
      : [emptyLine()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<"draft" | "save" | "saveNew" | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const contactsQuery = useContacts({ limit: 100, accountId });
  const opportunitiesQuery = useOpportunities({
    limit: 100,
    accountId,
    status: "OPEN",
  });
  const [accountSearch, setAccountSearch] = useState("");
  const [accountLabel, setAccountLabel] = useState(
    existing?.account?.name ?? "",
  );
  const accountsQuery = useAccounts({
    limit: 20,
    order: "asc",
    ...(accountSearch ? { search: accountSearch } : {}),
  });
  const accounts = accountsQuery.data?.data ?? [];

  const createMutation = useCreateQuotation();
  const replaceMutation = useReplaceQuotation();

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    lines.forEach((l) => {
      const c = computeLine(l);
      subtotal += c.gross;
      totalDiscount += c.discountAmount;
      totalTax += c.taxAmount;
    });
    subtotal = round2(subtotal);
    totalDiscount = round2(totalDiscount);
    totalTax = round2(totalTax);
    const grandTotal = round2(
      subtotal - totalDiscount + totalTax + (adjustment || 0),
    );
    return { subtotal, totalDiscount, totalTax, grandTotal };
  }, [lines, adjustment]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }
  function setLineProduct(key: string, product: Product) {
    updateLine(key, {
      productId: product.id,
      productLabel: product.name,
      productCode: product.code,
      description: product.description || product.name,
      listPrice: Number(product.unitPrice),
      unitPrice: Number(product.unitPrice),
      taxPercent: product.taxPercent ? Number(product.taxPercent) : 0,
    });
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(key: string) {
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  }
  function copyBillingToShipping() {
    setShipping({ ...billing });
    toast.success("Billing address copied to Shipping");
  }

  async function handleSave(mode: "draft" | "save" | "saveNew") {
    setSubmitted(true);
    setSubmitError(null);
    const finalStatus = mode === "draft" ? "Draft" : status;
    const meaningfulLines = lines.filter(
      (l) => l.description.trim() || l.productId,
    );

    const result = quotationPayloadSchema.safeParse({
      accountId,
      opportunityId,
      contactId,
      subject,
      status: finalStatus,
      quoteOwner: quoteOwner || undefined,
      currency,
      quoteDate,
      validUntil,
      customerReference: customerReference || undefined,
      billingStreet: billing.street || undefined,
      billingCity: billing.city || undefined,
      billingState: billing.state || undefined,
      billingPostalCode: billing.postalCode || undefined,
      billingCountry: billing.country || undefined,
      shippingStreet: shipping.street || undefined,
      shippingCity: shipping.city || undefined,
      shippingState: shipping.state || undefined,
      shippingPostalCode: shipping.postalCode || undefined,
      shippingCountry: shipping.country || undefined,
      carrier: carrier || undefined,
      deliveryNotes: deliveryNotes || undefined,
      termsConditions: termsConditions || undefined,
      paymentTerms: paymentTerms || undefined,
      deliveryTerms: deliveryTerms || undefined,
      notes: notes || undefined,
      adjustment,
      items: meaningfulLines.map((l) => ({
        productId: l.productId,
        description: l.description || l.productCode || "Item",
        uom: l.uom || undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        taxPercent: l.taxPercent,
      })),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    setErrors({});
    setSaving(mode);
    try {
      if (isEdit && existing) {
        await replaceMutation.mutateAsync({
          id: existing.id,
          input: result.data,
        });
        toast.success("Quote updated successfully");
        celebrateCrm(
          finalStatus === "Sent" && existing.status !== "Sent"
            ? "quote.sent"
            : "quote.statusChanged",
        );
      } else {
        const created = await createMutation.mutateAsync(result.data);
        toast.success(`Quote ${created.quotationNumber} created successfully`);
        celebrateCrm("quote.created");
      }
      if (mode === "saveNew") {
        router.push("/crm/quotes/new");
      } else {
        router.push("/crm/quotes");
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Failed to save the quote — please try again.",
      );
    } finally {
      setSaving(null);
    }
  }

  const saving_ = saving !== null;
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const contacts = contactsQuery.data?.data ?? [];
  const selectedContact = contacts.find((c) => c.id === contactId);
  const sym = currencySymbol(currency);

  function handlePrint() {
    if (!existing) return;
    const opened = printQuotation(existing);
    if (!opened) {
      toast.error(
        "Pop-up blocked. Please allow pop-ups for this site, then try Print / PDF again.",
      );
    }
  }

  async function handleDelete() {
    if (!existing) return;
    try {
      await deleteMutation.mutateAsync(existing.id);
    } catch (err) {
      throw new Error(
        err instanceof ApiError ? err.message : "Could not delete the quote.",
      );
    }
    toast.success("Quote deleted");
    router.push("/crm/quotes");
  }

  const hdr = `font-black text-sm uppercase tracking-wider text-white py-2.5`;

  return (
    <div className="space-y-6 pb-8">
      <BackToDashboardButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => router.push("/crm/quotes")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotes
        </Button>
        {isEdit && existing && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </Button>
            {canDelete && (
              <DeleteConfirmDialog
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Quote
                  </Button>
                }
                title={`Delete quote ${existing.quotationNumber}?`}
                description="This quote and its line items will be moved to the CRM Recycle Bin. The linked Account, Contact, Deal, and Products are never affected."
                onConfirm={handleDelete}
              />
            )}
          </div>
        )}
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* --- Quote Header / Basic Information --- */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden space-y-5">
        <div className="relative overflow-hidden flex items-center justify-between flex-wrap gap-3 p-6 pb-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEdit
                  ? `Quote ${existing?.quotationNumber ?? ""}`
                  : "New Quote"}
              </h2>
              <p className="text-sm text-slate-600">
                {isEdit
                  ? "Edit the details, items, and terms of this quote."
                  : "Quote number is assigned automatically once saved."}
              </p>
            </div>
          </div>
          <Badge
            className={cn("relative border", QUOTATION_STATUS_STYLE[status])}
          >
            {status}
          </Badge>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Account *</Label>
              <AsyncPicker
                selectedId={accountId}
                selectedLabel={accountLabel}
                placeholder="Select an account"
                searchPlaceholder="Search accounts…"
                invalid={Boolean(submitted && errors.accountId)}
                loading={accountsQuery.isFetching}
                onSearchChange={setAccountSearch}
                options={accounts.map((a) => ({ id: a.id, label: a.name }))}
                onSelect={(o) => {
                  setAccountId(o.id);
                  setAccountLabel(o.label);
                  setContactId(undefined);
                  setOpportunityId(undefined);
                }}
              />
              <FieldError message={submitted ? errors.accountId : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label>Deal</Label>
              <Select
                value={opportunityId ? String(opportunityId) : ""}
                onValueChange={(v) => setOpportunityId(Number(v))}
                disabled={!accountId}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Optional — link to a deal" />
                </SelectTrigger>
                <SelectContent>
                  {(opportunitiesQuery.data?.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select
                value={contactId ? String(contactId) : ""}
                onValueChange={(v) => setContactId(Number(v))}
                disabled={!accountId}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this quote for?"
                className={cn(
                  "h-9 rounded-xl",
                  submitted && errors.subject && "border-red-400",
                )}
              />
              <FieldError message={submitted ? errors.subject : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label>Quote Owner</Label>
              <Input
                value={quoteOwner}
                onChange={(e) => setQuoteOwner(e.target.value)}
                placeholder="Salesperson"
                className="h-9 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quote Date</Label>
              <DateField
                label="Quote Date"
                value={quoteDate}
                onChange={setQuoteDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until *</Label>
              <DateField
                label="Valid Until"
                value={validUntil}
                onChange={setValidUntil}
                invalid={submitted && Boolean(errors.validUntil)}
              />
              <FieldError message={submitted ? errors.validUntil : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as QuotationStatus)}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Customer PO / Reference</Label>
              <Input
                value={customerReference}
                onChange={(e) => setCustomerReference(e.target.value)}
                placeholder="Customer's PO number, if any"
                className="h-9 rounded-xl"
              />
            </div>
          </div>

          {/* --- Account / Customer information --- */}
          {(selectedAccount || selectedContact) && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 grid sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Account
                  </p>
                  <p className="text-sm text-slate-700 truncate">
                    {selectedAccount?.name || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Contact Email
                  </p>
                  <p className="text-sm text-slate-700 truncate">
                    {selectedContact?.email || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Contact Phone
                  </p>
                  <p className="text-sm text-slate-700 truncate">
                    {selectedContact?.phone || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* --- Billing / Shipping addresses --- */}
          <div className="grid md:grid-cols-2 gap-4">
            <AddressBox
              title="Billing Address"
              tone="rose"
              value={billing}
              onChange={setBilling}
            />
            <AddressBox
              title="Shipping Address"
              tone="sky"
              value={shipping}
              onChange={setShipping}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs rounded-lg gap-1"
                  onClick={copyBillingToShipping}
                >
                  <Copy className="h-3 w-3" /> Copy Billing
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* --- Quoted Items --- */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-black">Quoted Items</h3>
            <p className="text-sm text-slate-600">
              Search and add products, or type a free-text line item.
            </p>
          </div>
          <Button size="sm" className="rounded-xl gap-1.5" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>
        {submitted && errors.items && (
          <div className="px-5 pt-4">
            <FieldError message={errors.items} />
          </div>
        )}
        <div className="overflow-x-auto crm-tracker-scroll">
          <Table>
            <TableHeader className="text-white">
              <TableRow
                className="hover:bg-transparent border-none"
                style={{
                  background:
                    "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                }}
              >
                <TableHead className={`w-10 ${hdr}`}>S.No</TableHead>
                <TableHead className={`min-w-[200px] ${hdr}`}>
                  Product / Service
                </TableHead>
                <TableHead className={`w-24 ${hdr}`}>Code</TableHead>
                <TableHead className={`min-w-[160px] ${hdr}`}>
                  Description
                </TableHead>
                <TableHead className={`w-16 ${hdr}`}>Qty</TableHead>
                <TableHead className={`w-20 ${hdr}`}>UOM</TableHead>
                <TableHead className={`w-24 ${hdr}`}>List Price</TableHead>
                <TableHead className={`w-24 ${hdr}`}>Unit Price</TableHead>
                <TableHead className={`w-20 ${hdr}`}>Disc %</TableHead>
                <TableHead className={`w-24 ${hdr}`}>Disc Amt</TableHead>
                <TableHead className={`w-16 ${hdr}`}>Tax %</TableHead>
                <TableHead className={`w-24 ${hdr}`}>Tax Amt</TableHead>
                <TableHead className={`w-28 ${hdr}`}>Total</TableHead>
                <TableHead className={`w-10 ${hdr}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => {
                const c = computeLine(line);
                return (
                  <TableRow
                    key={line.key}
                    className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                  >
                    <TableCell className="text-base text-slate-400 py-1">
                      {index + 1}
                    </TableCell>
                    <TableCell className="min-w-[200px] text-base py-1">
                      <QuoteProductPicker
                        value={line.productId}
                        selectedLabel={line.productLabel}
                        currencySymbol={sym}
                        onSelect={(p) => setLineProduct(line.key, p)}
                      />
                    </TableCell>
                    <TableCell className="text-base text-slate-500 py-1">
                      {line.productCode || "—"}
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.key, { description: e.target.value })
                        }
                        className="h-8 rounded-lg text-xs"
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-8 rounded-lg text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        value={line.uom}
                        onChange={(e) =>
                          updateLine(line.key, { uom: e.target.value })
                        }
                        placeholder="Nos"
                        className="h-8 rounded-lg text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-base text-slate-500 py-1">
                      {formatMoney(line.listPrice, currency)}
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                        className="h-8 rounded-lg text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discountPercent}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discountPercent: Math.min(
                              100,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                        className="h-8 rounded-lg text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-base text-slate-500 py-1">
                      {formatMoney(c.discountAmount, currency)}
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Input
                        type="number"
                        min={0}
                        value={line.taxPercent}
                        onChange={(e) =>
                          updateLine(line.key, {
                            taxPercent: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                        className="h-8 rounded-lg text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-base text-slate-500 py-1">
                      {formatMoney(c.taxAmount, currency)}
                    </TableCell>
                    <TableCell className="text-base font-bold text-slate-800 py-1">
                      {formatMoney(c.total, currency)}
                    </TableCell>
                    <TableCell className="text-base py-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 rounded-lg"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* --- Summary --- */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="text-red-500">
                −{formatMoney(totals.totalDiscount, currency)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{formatMoney(totals.totalTax, currency)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Adjustment</span>
              <Input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                className="h-8 w-28 rounded-lg text-right text-xs"
              />
            </div>
            <div className="flex justify-between items-baseline text-base font-bold text-brand-700 pt-3 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-lg">
                {formatMoney(totals.grandTotal, currency)}
              </span>
            </div>
            <p className="text-xs text-slate-400 italic">
              Preview only — the server recomputes every total on save.
            </p>
          </div>
        </div>
      </div>

      {/* --- Terms & Conditions / Delivery --- */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 flex items-center justify-center rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60">
            <FileText className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-black">
            Terms &amp; Conditions
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Terms &amp; Conditions</Label>
            <Textarea
              rows={3}
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              placeholder="General terms and conditions for this quote"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Terms</Label>
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. 50% advance, balance on delivery"
              className="h-9 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Terms</Label>
            <Input
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              placeholder="e.g. 4–6 weeks from PO"
              className="h-9 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-slate-400" /> Carrier
            </Label>
            <Input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Shipping carrier, if any"
              className="h-9 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery / Shipping Notes</Label>
            <Input
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Special delivery instructions"
              className="h-9 rounded-xl"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Additional Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else worth noting on this quote"
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* --- Action bar --- */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {isEdit && existing?.updatedAt && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Last updated{" "}
              {new Date(existing.updatedAt).toLocaleString("en-IN")}
            </span>
          )}
          {!isEdit && currentUser && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Created by {currentUser}
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            disabled={saving_}
            onClick={() => router.push("/crm/quotes")}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={saving_}
            onClick={() => void handleSave("draft")}
          >
            {saving === "draft" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}{" "}
            Save Draft
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={saving_}
            onClick={() => void handleSave("saveNew")}
          >
            {saving === "saveNew" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}{" "}
            Save &amp; New
          </Button>
          <Button
            className="rounded-xl gap-1.5"
            disabled={saving_}
            onClick={() => void handleSave("save")}
          >
            {saving === "save" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving === "save"
              ? "Saving…"
              : isEdit
                ? "Save Changes"
                : "Create Quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 shrink-0" /> {message}
    </p>
  );
}

/** Legacy Popover + Calendar date button (Quote Date / Valid Until). */
function DateField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean | undefined;
}) {
  const selected = fromIsoDateStr(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full rounded-xl justify-between font-normal text-slate-800",
            invalid && "border-red-400",
          )}
        >
          {selected
            ? selected.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Select date"}
          <CalendarDays className="h-4 w-4 text-brand-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl"
        align="start"
      >
        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-800">{label}</p>
          <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            Today:{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => date && onChange(toIsoDateStr(date))}
          className="rounded-md border-0"
        />
      </PopoverContent>
    </Popover>
  );
}

type Address = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function AddressBox({
  title,
  tone,
  value,
  onChange,
  action,
}: {
  title: string;
  tone: "rose" | "sky";
  value: Address;
  onChange: (next: Address) => void;
  action?: React.ReactNode;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  const iconTone =
    tone === "rose"
      ? "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 border-rose-200/60"
      : "bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60";
  return (
    <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold uppercase tracking-wide text-black flex items-center gap-1.5">
          <span
            className={`h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] ${iconTone}`}
          >
            <MapPin className="h-3 w-3" />
          </span>{" "}
          {title}
        </p>
        {action}
      </div>
      <Input
        placeholder="Street"
        value={value.street}
        onChange={(e) => set({ street: e.target.value })}
        className="h-9 rounded-xl"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          className="h-9 rounded-xl"
        />
        <Input
          placeholder="State/Province"
          value={value.state}
          onChange={(e) => set({ state: e.target.value })}
          className="h-9 rounded-xl"
        />
        <Input
          placeholder="Postal Code"
          value={value.postalCode}
          onChange={(e) => set({ postalCode: e.target.value })}
          className="h-9 rounded-xl"
        />
        <Input
          placeholder="Country"
          value={value.country}
          onChange={(e) => set({ country: e.target.value })}
          className="h-9 rounded-xl"
        />
      </div>
    </div>
  );
}
