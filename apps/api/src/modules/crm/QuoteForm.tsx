// CRM Core Domain — Quote create/edit/detail page. Full page (not a modal) because the dynamic
// line-item table needs room, modeled on the calculation pattern already used by the Sales
// module's `CreateQuotation.tsx` (add/remove row, reactive subtotal/tax/grand-total) but rebuilt
// against the CRM-scoped `CrmQuotationLineItem`/flat-tax-percent model rather than Sales' India-
// GST split. Also doubles as the quote's detail/view experience — the CRM has no separate
// read-only record page pattern (Deal/Account detail pages are themselves editable), so a saved
// quote is both viewed and edited from this same route.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { celebrateCrm } from "./celebration";
import QuotationPrintTemplate from "@/components/QuotationPrintTemplate";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  changeCrmQuotationStatus,
  createCrmQuotation,
  deleteCrmQuotation,
  setCrmQuotationItems,
  subscribeCrmQuotationItems,
  updateCrmQuotation,
} from "./domain/quotationsService";
import { QuoteProductPicker } from "./domain/QuoteProductPicker";
import { computeLineBreakdown } from "./domain/dealProductsService";
import {
  QUOTATION_STATUS_STYLE,
  currencySymbol,
  formatMoney,
} from "./domain/currency";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import {
  CrmProduct,
  CrmQuotationLineItem,
  CrmQuotationStatus,
} from "./domain/types";
import { DeleteConfirmDialog } from "./intelligence/components";
import { isCrmAdmin } from "./domain/roles";

const QUOTE_STATUSES: CrmQuotationStatus[] = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
];

const STATUS_STYLE = QUOTATION_STATUS_STYLE;

const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "AED", symbol: "AED " },
];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parses a 'YYYY-MM-DD' string into a local Date for the calendar picker, and formats a picked
 *  Date back the same way — building via the (y, m, d) numeric overload avoids the UTC-parsing
 *  shift a plain `new Date(string)` would apply. */
function fromIsoDateStr(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toIsoDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DraftLine {
  key: string;
  productId?: string;
  productCode?: string;
  description: string;
  uom?: string;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: 1,
  listPrice: 0,
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: 0,
});

function computeLine(
  line: Pick<
    DraftLine,
    "quantity" | "unitPrice" | "discountPercent" | "taxPercent"
  >,
) {
  return computeLineBreakdown(
    line.quantity,
    line.unitPrice,
    line.discountPercent,
    line.taxPercent,
  );
}

interface FormErrors {
  accountId?: string;
  subject?: string;
  validUntil?: string;
  items?: string;
}

type SaveMode = "draft" | "save" | "saveNew";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 shrink-0" /> {message}
    </p>
  );
}

export default function QuoteForm() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromDashboard = !!(
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";

  const { accounts, contacts, opportunities, products, quotations, loading } =
    useCrmDomainData();
  const existing = quotationId
    ? quotations.find((q) => q.id === quotationId)
    : undefined;
  const isEdit = !!quotationId;

  const [accountId, setAccountId] = useState(
    searchParams.get("accountId") || "",
  );
  const [opportunityId, setOpportunityId] = useState(
    searchParams.get("dealId") || "",
  );
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<CrmQuotationStatus>("Draft");
  const [quoteOwner, setQuoteOwner] = useState(currentUser);
  const [currency, setCurrency] = useState("INR");
  const [quoteDate, setQuoteDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState(addDaysISO(todayISO(), 30));
  const [customerReference, setCustomerReference] = useState("");
  const [billing, setBilling] = useState({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [shipping, setShipping] = useState({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [carrier, setCarrier] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [adjustment, setAdjustment] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);
  const [submitted, setSubmitted] = useState(false);

  // Hydrate from an existing quotation (edit mode) once its record + line items arrive.
  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setAccountId(existing.accountId);
    setOpportunityId(existing.opportunityId || "");
    setContactId(existing.contactId || "");
    setSubject(existing.subject || "");
    setStatus(existing.status);
    setQuoteOwner(existing.quoteOwner || existing.createdBy || currentUser);
    setCurrency(existing.currency || "INR");
    setQuoteDate(
      existing.quoteDate ||
        new Date(existing.createdAt).toISOString().slice(0, 10),
    );
    setValidUntil(existing.validUntil || "");
    setCustomerReference(existing.customerReference || "");
    setBilling({
      street: existing.billingStreet || "",
      city: existing.billingCity || "",
      state: existing.billingState || "",
      postalCode: existing.billingPostalCode || "",
      country: existing.billingCountry || "",
    });
    setShipping({
      street: existing.shippingStreet || "",
      city: existing.shippingCity || "",
      state: existing.shippingState || "",
      postalCode: existing.shippingPostalCode || "",
      country: existing.shippingCountry || "",
    });
    setCarrier(existing.carrier || "");
    setDeliveryNotes(existing.deliveryNotes || "");
    setTermsConditions(existing.termsConditions || "");
    setPaymentTerms(existing.paymentTerms || "");
    setDeliveryTerms(existing.deliveryTerms || "");
    setNotes(existing.notes || "");
    setAdjustment(existing.adjustment || 0);
    setHydrated(true);
  }, [isEdit, existing, hydrated, currentUser]);

  useEffect(() => {
    if (!quotationId) return undefined;
    return subscribeCrmQuotationItems(quotationId, (items) => {
      if (items.length === 0) return;
      setLines(
        items.map((item) => ({
          key: item.id,
          productId: item.productId || undefined,
          productCode: item.productCode || undefined,
          description: item.description,
          uom: item.uom || undefined,
          quantity: item.quantity,
          listPrice: item.listPrice,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          taxPercent: item.taxPercent || 0,
        })),
      );
    });
  }, [quotationId]);

  // Opening "New Quote" from a Deal preselects the deal + account via URL params (see initial
  // state above); this effect runs once those deals are loaded and pulls the deal's own primary
  // contact/currency across too, so the quote doesn't start with an empty Contact.
  useEffect(() => {
    if (isEdit || !opportunityId || contactId || loading) return;
    const deal = opportunities.find((o) => o.id === opportunityId);
    if (deal?.contactId) setContactId(deal.contactId);
    if (deal?.currency) setCurrency(deal.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, loading, opportunities.length]);

  /** Selecting a Deal manually (not just via the URL-prefill effect above) pulls its primary
   *  contact + currency across the same way, so the behavior is consistent either way. */
  const handleDealChange = (dealId: string) => {
    setOpportunityId(dealId);
    const deal = opportunities.find((o) => o.id === dealId);
    if (deal?.contactId) setContactId(deal.contactId);
    if (deal?.currency) setCurrency(deal.currency);
  };

  const accountContacts = useMemo(
    () => contacts.filter((c) => c.accountId === accountId),
    [contacts, accountId],
  );
  const accountDeals = useMemo(
    () =>
      opportunities.filter(
        (o) => o.accountId === accountId && o.status === "OPEN",
      ),
    [opportunities, accountId],
  );
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );
  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId),
    [contacts, contactId],
  );

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

  const errors = useMemo<FormErrors>(() => {
    const e: FormErrors = {};
    if (!accountId) e.accountId = "Account is required.";
    if (!subject.trim()) e.subject = "Subject is required.";
    if (!validUntil) e.validUntil = "Valid Until date is required.";
    else if (quoteDate && validUntil < quoteDate)
      e.validUntil = "Valid Until must be on or after the Quote Date.";
    const meaningfulLines = lines.filter(
      (l) => l.description.trim() || l.productId,
    );
    if (meaningfulLines.length === 0) e.items = "Add at least one quoted item.";
    else if (meaningfulLines.some((l) => l.quantity <= 0))
      e.items = "Every quoted item needs a quantity greater than 0.";
    return e;
  }, [accountId, subject, validUntil, quoteDate, lines]);

  const hasErrors = Object.keys(errors).length > 0;

  const printRef = useRef<HTMLDivElement>(null);
  const printData = useMemo(
    () => ({
      quoteNumber: existing?.quotationNumber || "DRAFT",
      currency,
      quoteDate,
      validity: validUntil,
      paymentTerms,
      deliveryTerm: deliveryTerms,
      remarks: notes,
      termsAndConditions: termsConditions,
      customerName: selectedAccount?.name || "Customer",
      billingAddress: billing.street
        ? {
            street: billing.street,
            city: billing.city,
            state: billing.state,
            pincode: billing.postalCode,
            country: billing.country,
          }
        : null,
      shippingAddress: shipping.street
        ? {
            street: shipping.street,
            city: shipping.city,
            state: shipping.state,
            pincode: shipping.postalCode,
            country: shipping.country,
          }
        : null,
      lineItems: lines
        .filter((l) => l.description.trim() || l.productId)
        .map((l, i) => ({
          sNo: i + 1,
          productDescription: l.description || l.productCode || "Item",
          qty: l.quantity,
          unitRate: l.unitPrice,
          netAmount: computeLine(l).total,
        })),
      subtotal: totals.subtotal,
      igstAmount: totals.totalTax || undefined,
      roundOff:
        totals.grandTotal -
        totals.subtotal -
        (totals.totalTax || 0) +
        totals.totalDiscount,
      grandTotal: totals.grandTotal,
    }),
    [
      existing,
      currency,
      quoteDate,
      validUntil,
      paymentTerms,
      deliveryTerms,
      notes,
      termsConditions,
      selectedAccount,
      billing,
      shipping,
      lines,
      totals,
    ],
  );

  const handlePrint = () => {
    if (!printRef.current) return;
    const element = printRef.current;
    const toastId = toast.loading("Opening Print / PDF Generator...");
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to generate PDF.", {
        id: toastId,
      });
      return;
    }
    printWindow.document.write(
      `<!DOCTYPE html><html><head>
      <title>${printData.quoteNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 6mm; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
        tr, .no-break { page-break-inside: avoid !important; break-inside: avoid !important; }
        table, td, th { box-sizing: border-box !important; vertical-align: middle !important; }
      </style></head><body>
      <div style="width:100%;display:flex;justify-content:center;padding:0">${element.innerHTML}</div>
      <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},250);};<` +
        `/script>
      </body></html>`,
    );
    printWindow.document.close();
    toast.success("Print window opened!", { id: toastId });
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const setLineProduct = (key: string, product: CrmProduct) => {
    updateLine(key, {
      productId: product.id,
      productCode: product.code,
      description: product.description || product.name,
      listPrice: product.unitPrice,
      unitPrice: product.unitPrice,
      taxPercent: product.taxPercent || 0,
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key: string) =>
    setLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  const copyBillingToShipping = () => {
    setShipping({ ...billing });
    toast.success("Billing address copied to Shipping");
  };

  const resetForm = () => {
    setAccountId("");
    setOpportunityId("");
    setContactId("");
    setSubject("");
    setStatus("Draft");
    setQuoteOwner(currentUser);
    setCurrency("INR");
    setQuoteDate(todayISO());
    setValidUntil(addDaysISO(todayISO(), 30));
    setCustomerReference("");
    setBilling({
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    });
    setShipping({
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    });
    setCarrier("");
    setDeliveryNotes("");
    setTermsConditions("");
    setPaymentTerms("");
    setDeliveryTerms("");
    setNotes("");
    setAdjustment(0);
    setLines([emptyLine()]);
    setSubmitted(false);
  };

  const handleSave = async (mode: SaveMode) => {
    setSubmitted(true);
    if (hasErrors) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    const finalStatus: CrmQuotationStatus = mode === "draft" ? "Draft" : status;
    setSaving(mode);
    try {
      const itemsPayload: Omit<CrmQuotationLineItem, "id" | "quotationId">[] =
        lines
          .filter((l) => l.description.trim() || l.productId)
          .map((l) => {
            const c = computeLine(l);
            return {
              productId: l.productId || null,
              productCode: l.productCode || null,
              description: l.description,
              uom: l.uom || null,
              quantity: l.quantity,
              listPrice: l.listPrice,
              unitPrice: l.unitPrice,
              discountPercent: l.discountPercent,
              discountAmount: c.discountAmount,
              taxPercent: l.taxPercent,
              taxAmount: c.taxAmount,
              amount: c.total,
            };
          });

      // Firebase `set()`/`update()` reject `undefined` values outright — every optional field
      // below falls back to `null` (RTDB's own "no value" idiom), never `undefined`.
      const headerFields = {
        accountId,
        opportunityId: opportunityId || null,
        contactId: contactId || null,
        subject: subject || null,
        status: finalStatus,
        quoteOwner: quoteOwner || null,
        currency: currency || "INR",
        quoteDate: quoteDate || null,
        validUntil: validUntil || null,
        customerReference: customerReference || null,
        billingStreet: billing.street || null,
        billingCity: billing.city || null,
        billingState: billing.state || null,
        billingPostalCode: billing.postalCode || null,
        billingCountry: billing.country || null,
        shippingStreet: shipping.street || null,
        shippingCity: shipping.city || null,
        shippingState: shipping.state || null,
        shippingPostalCode: shipping.postalCode || null,
        shippingCountry: shipping.country || null,
        carrier: carrier || null,
        deliveryNotes: deliveryNotes || null,
        termsConditions: termsConditions || null,
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        notes: notes || null,
        adjustment,
      };

      let targetId = quotationId;
      if (!targetId) {
        const quotationNumber = `QUO-${Date.now().toString(36).toUpperCase()}`;
        targetId = await createCrmQuotation(
          { ...headerFields, quotationNumber, amount: totals.grandTotal },
          currentUser,
        );
        // Created directly as Sent/Accepted/etc. (Save & Send on a brand-new quote) — that's a
        // real status transition too and must leave the same audit/timeline trail an existing
        // quote's status change would, not just the plain "quotation_created" entry.
        if (finalStatus !== "Draft") {
          await changeCrmQuotationStatus(
            targetId,
            quotationNumber,
            finalStatus,
            currentUser,
            {
              accountId: headerFields.accountId,
              opportunityId: headerFields.opportunityId || undefined,
            },
          );
        }
      } else {
        await updateCrmQuotation(targetId, headerFields, currentUser);
        if (existing && existing.status !== finalStatus) {
          await changeCrmQuotationStatus(
            targetId,
            existing.quotationNumber,
            finalStatus,
            currentUser,
            {
              accountId: headerFields.accountId,
              opportunityId: headerFields.opportunityId || undefined,
            },
          );
        }
      }

      await setCrmQuotationItems(
        targetId,
        itemsPayload,
        { ...totals, adjustment: adjustment || 0 },
        currentUser,
      );
      toast.success(
        isEdit ? "Quote updated successfully" : "Quote created successfully",
      );
      if (!isEdit) {
        celebrateCrm("quote.created");
      } else if (finalStatus === "Sent" && existing?.status !== "Sent") {
        celebrateCrm("quote.sent");
      } else {
        celebrateCrm("quote.statusChanged");
      }

      if (mode === "saveNew") {
        resetForm();
        navigate("/crm/quotes/new");
      } else {
        navigate("/crm/quotes");
      }
    } catch (err) {
      console.error("Failed to save Quote:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to save the quote — please try again.",
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading || (isEdit && !hydrated))
    return (
      <div className="text-center py-16 text-slate-400 text-xs">
        Loading Quote…
      </div>
    );

  return (
    <div className="space-y-6 pb-8">
      <BackToDashboardButton />
      <div className="flex items-center justify-between flex-wrap gap-3">
        {fromDashboard ? (
          <div />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => navigate("/crm/quotes")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotes
          </Button>
        )}
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
            {isCrmAdmin(user) && (
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
                onConfirm={async () => {
                  await deleteCrmQuotation(
                    existing.id,
                    existing.quotationNumber,
                    user,
                  );
                  toast.success("Quote deleted");
                  navigate("/crm/quotes");
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Off-screen render target for Print/PDF — never shown, only used to grab printable HTML. */}
      <div className="fixed -left-[9999px] top-0" aria-hidden="true">
        <div ref={printRef}>
          <QuotationPrintTemplate quotation={printData} />
        </div>
      </div>

      {/* --- Quote Header / Basic Information --------------------------------------------- */}
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
                  ? `Quote ${existing?.quotationNumber || ""}`
                  : "New Quote"}
              </h2>
              <p className="text-sm text-slate-600">
                {isEdit
                  ? "Edit the details, items, and terms of this quote."
                  : "Quote number is assigned automatically once saved."}
              </p>
            </div>
          </div>
          <Badge className={cn("relative border", STATUS_STYLE[status])}>
            {status}
          </Badge>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Account *</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v);
                  setContactId("");
                  setOpportunityId("");
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 rounded-xl",
                    submitted && errors.accountId && "border-red-400",
                  )}
                >
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={submitted ? errors.accountId : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label>Deal</Label>
              <Select
                value={opportunityId}
                onValueChange={handleDealChange}
                disabled={!accountId}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Optional — link to a deal" />
                </SelectTrigger>
                <SelectContent>
                  {accountDeals.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select
                value={contactId}
                onValueChange={setContactId}
                disabled={!accountId}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {accountContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full rounded-xl justify-between font-normal text-slate-800"
                  >
                    {quoteDate
                      ? fromIsoDateStr(quoteDate)?.toLocaleDateString("en-IN", {
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
                    <p className="text-xs font-bold text-slate-800">
                      Quote Date
                    </p>
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
                    selected={fromIsoDateStr(quoteDate)}
                    onSelect={(date) =>
                      date && setQuoteDate(toIsoDateStr(date))
                    }
                    className="rounded-md border-0"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 w-full rounded-xl justify-between font-normal text-slate-800",
                      submitted && errors.validUntil && "border-red-400",
                    )}
                  >
                    {validUntil
                      ? fromIsoDateStr(validUntil)?.toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : "Select date"}
                    <CalendarDays className="h-4 w-4 text-brand-600" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-3 z-50 bg-white border border-slate-200 shadow-xl rounded-2xl"
                  align="start"
                >
                  <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">
                      Valid Until
                    </p>
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
                    selected={fromIsoDateStr(validUntil)}
                    onSelect={(date) =>
                      date && setValidUntil(toIsoDateStr(date))
                    }
                    className="rounded-md border-0"
                  />
                </PopoverContent>
              </Popover>
              <FieldError message={submitted ? errors.validUntil : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CrmQuotationStatus)}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUSES.map((s) => (
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
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
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

          {/* --- Account / Customer information ---------------------------------------------- */}
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

          {/* --- Billing / Shipping addresses --------------------------------------------------- */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
              <p className="text-sm font-extrabold uppercase tracking-wide text-black flex items-center gap-1.5">
                <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 border-rose-200/60">
                  <MapPin className="h-3 w-3" />
                </span>{" "}
                Billing Address
              </p>
              <Input
                placeholder="Street"
                value={billing.street}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, street: e.target.value }))
                }
                className="h-9 rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={billing.city}
                  onChange={(e) =>
                    setBilling((b) => ({ ...b, city: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="State/Province"
                  value={billing.state}
                  onChange={(e) =>
                    setBilling((b) => ({ ...b, state: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Postal Code"
                  value={billing.postalCode}
                  onChange={(e) =>
                    setBilling((b) => ({ ...b, postalCode: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Country"
                  value={billing.country}
                  onChange={(e) =>
                    setBilling((b) => ({ ...b, country: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold uppercase tracking-wide text-black flex items-center gap-1.5">
                  <span className="h-6 w-6 flex items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60">
                    <MapPin className="h-3 w-3" />
                  </span>{" "}
                  Shipping Address
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs rounded-lg gap-1"
                  onClick={copyBillingToShipping}
                >
                  <Copy className="h-3 w-3" /> Copy Billing
                </Button>
              </div>
              <Input
                placeholder="Street"
                value={shipping.street}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, street: e.target.value }))
                }
                className="h-9 rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={shipping.city}
                  onChange={(e) =>
                    setShipping((s) => ({ ...s, city: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="State/Province"
                  value={shipping.state}
                  onChange={(e) =>
                    setShipping((s) => ({ ...s, state: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Postal Code"
                  value={shipping.postalCode}
                  onChange={(e) =>
                    setShipping((s) => ({ ...s, postalCode: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Country"
                  value={shipping.country}
                  onChange={(e) =>
                    setShipping((s) => ({ ...s, country: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Quoted Items ------------------------------------------------------------------- */}
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
                    "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
              >
                <TableHead className="w-10 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  S.No
                </TableHead>
                <TableHead className="min-w-[200px] font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Product / Service
                </TableHead>
                <TableHead className="w-24 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Code
                </TableHead>
                <TableHead className="min-w-[160px] font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Description
                </TableHead>
                <TableHead className="w-16 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Qty
                </TableHead>
                <TableHead className="w-20 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  UOM
                </TableHead>
                <TableHead className="w-24 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  List Price
                </TableHead>
                <TableHead className="w-24 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Unit Price
                </TableHead>
                <TableHead className="w-20 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Disc %
                </TableHead>
                <TableHead className="w-24 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Disc Amt
                </TableHead>
                <TableHead className="w-16 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Tax %
                </TableHead>
                <TableHead className="w-24 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Tax Amt
                </TableHead>
                <TableHead className="w-28 font-black text-sm uppercase tracking-wider text-white py-2.5">
                  Total
                </TableHead>
                <TableHead className="w-10 font-black text-sm uppercase tracking-wider text-white py-2.5" />
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
                        products={products}
                        value={line.productId}
                        currencySymbol={currencySymbol(currency)}
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
                        value={line.uom || ""}
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

        {/* --- Summary --------------------------------------------------------------------- */}
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
          </div>
        </div>
      </div>

      {/* --- Terms & Conditions / Delivery --------------------------------------------------- */}
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

      {/* --- Action bar ---------------------------------------------------------------------- */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {isEdit && existing?.updatedAt && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Last updated{" "}
              {new Date(existing.updatedAt).toLocaleString("en-IN")}
            </span>
          )}
          {!isEdit && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Created by {currentUser}
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            disabled={!!saving}
            onClick={() => navigate("/crm/quotes")}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={!!saving}
            onClick={() => handleSave("draft")}
          >
            {saving === "draft" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}{" "}
            Save Draft
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            disabled={!!saving}
            onClick={() => handleSave("saveNew")}
          >
            {saving === "saveNew" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}{" "}
            Save &amp; New
          </Button>
          <Button
            className="rounded-xl gap-1.5"
            disabled={!!saving}
            onClick={() => handleSave("save")}
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
