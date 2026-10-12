"use client";

import type { Quotation, QuotationStatus } from "@texawave-erp/api-types";
import {
  ApiError,
  QUOTATION_STATUSES,
  quotationPayloadSchema,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AccountCombobox } from "../../accounts/components/AccountCombobox";
import { useContacts } from "../../contacts/hooks";
import { useOpportunities } from "../../opportunities/hooks";
import { useProducts } from "../../products/hooks";
import { useCreateQuotation, useReplaceQuotation } from "../hooks";
import { printQuotation } from "../print/printQuotation";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

interface DraftLine {
  key: string;
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
  const { toast } = useToast();
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
  const [quoteOwner, setQuoteOwner] = useState(existing?.quoteOwner ?? "");
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
  const productsQuery = useProducts({ limit: 100 });
  const activeProducts = useMemo(
    () => (productsQuery.data?.data ?? []).filter((p) => p.isActive),
    [productsQuery.data],
  );

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
  function setLineProduct(key: string, productId: number) {
    const product = activeProducts.find((p) => p.id === productId);
    if (!product) return;
    updateLine(key, {
      productId: product.id,
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
    toast({ title: "Billing address copied to Shipping", variant: "success" });
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
        toast({ title: "Quote updated", variant: "success" });
      } else {
        const created = await createMutation.mutateAsync(result.data);
        toast({
          title: `Quote ${created.quotationNumber} created`,
          variant: "success",
        });
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

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          {isEdit ? `Quote ${existing?.quotationNumber}` : "New Quote"}
        </h1>
        <Button variant="secondary" onClick={() => router.push("/crm/quotes")}>
          Back to Quotes
        </Button>
      </div>

      {submitError ? (
        <Alert variant="error" title="Could not save">
          {submitError}
        </Alert>
      ) : null}

      {/* --- Header --- */}
      <section className="rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 dark:border-gray-800">
        <div className="grid md:grid-cols-3 gap-4">
          <AccountCombobox
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              setContactId(undefined);
              setOpportunityId(undefined);
            }}
            error={submitted ? errors.accountId : undefined}
          />
          <FormField label="Deal (optional)">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={opportunityId ?? ""}
                onChange={(e) =>
                  setOpportunityId(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                disabled={!accountId}
              >
                <option value="">Optional — link to a deal</option>
                {(opportunitiesQuery.data?.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Contact (optional)">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={contactId ?? ""}
                onChange={(e) =>
                  setContactId(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                disabled={!accountId}
              >
                <option value="">Optional</option>
                {(contactsQuery.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div className="md:col-span-2">
            <FormField
              label="Subject"
              required
              error={submitted ? errors.subject : undefined}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  invalid={fieldProps.invalid}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's this quote for?"
                />
              )}
            </FormField>
          </div>
          <FormField label="Quote Owner">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={quoteOwner}
                onChange={(e) => setQuoteOwner(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Quote Date">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Valid Until"
            required
            error={submitted ? errors.validUntil : undefined}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                invalid={fieldProps.invalid}
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Status">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={status}
                onChange={(e) => setStatus(e.target.value as QuotationStatus)}
              >
                {QUOTATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Currency">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Customer PO / Reference">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={customerReference}
                  onChange={(e) => setCustomerReference(e.target.value)}
                />
              )}
            </FormField>
          </div>
        </div>

        {/* --- Billing / Shipping --- */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2 dark:border-gray-800">
            <p className="text-theme-xs font-bold uppercase tracking-wide text-gray-500">
              Billing Address
            </p>
            <Input
              placeholder="Street"
              value={billing.street}
              onChange={(e) =>
                setBilling((b) => ({ ...b, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={billing.city}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, city: e.target.value }))
                }
              />
              <Input
                placeholder="State"
                value={billing.state}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, state: e.target.value }))
                }
              />
              <Input
                placeholder="Postal Code"
                value={billing.postalCode}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, postalCode: e.target.value }))
                }
              />
              <Input
                placeholder="Country"
                value={billing.country}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, country: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-theme-xs font-bold uppercase tracking-wide text-gray-500">
                Shipping Address
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={copyBillingToShipping}
              >
                Copy Billing
              </Button>
            </div>
            <Input
              placeholder="Street"
              value={shipping.street}
              onChange={(e) =>
                setShipping((s) => ({ ...s, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={shipping.city}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, city: e.target.value }))
                }
              />
              <Input
                placeholder="State"
                value={shipping.state}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, state: e.target.value }))
                }
              />
              <Input
                placeholder="Postal Code"
                value={shipping.postalCode}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, postalCode: e.target.value }))
                }
              />
              <Input
                placeholder="Country"
                value={shipping.country}
                onChange={(e) =>
                  setShipping((s) => ({ ...s, country: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* --- Line items --- */}
      <section className="rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
            Line Items
          </h3>
          <Button type="button" size="sm" variant="secondary" onClick={addLine}>
            Add Line
          </Button>
        </div>
        {submitted && errors.items ? (
          <p className="text-theme-xs text-error-600">{errors.items}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-theme-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="py-1 pr-2">Product</th>
                <th className="py-1 pr-2">Description</th>
                <th className="py-1 pr-2">Qty</th>
                <th className="py-1 pr-2">UOM</th>
                <th className="py-1 pr-2">List Price</th>
                <th className="py-1 pr-2">Unit Price</th>
                <th className="py-1 pr-2">Disc %</th>
                <th className="py-1 pr-2">Tax %</th>
                <th className="py-1 pr-2">Total</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const c = computeLine(line);
                return (
                  <tr
                    key={line.key}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-1.5 pr-2 min-w-[160px]">
                      <Select
                        value={line.productId ?? ""}
                        onChange={(e) =>
                          e.target.value
                            ? setLineProduct(line.key, Number(e.target.value))
                            : undefined
                        }
                      >
                        <option value="">Free text</option>
                        {activeProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-1.5 pr-2 min-w-[160px]">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.key, { description: e.target.value })
                        }
                        placeholder="Description"
                      />
                    </td>
                    <td className="py-1.5 pr-2 w-20">
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2 w-20">
                      <Input
                        value={line.uom}
                        onChange={(e) =>
                          updateLine(line.key, { uom: e.target.value })
                        }
                        placeholder="Nos"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-gray-500">
                      {line.listPrice}
                    </td>
                    <td className="py-1.5 pr-2 w-24">
                      <Input
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2 w-20">
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
                      />
                    </td>
                    <td className="py-1.5 pr-2 w-20">
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
                      />
                    </td>
                    <td className="py-1.5 pr-2 font-medium">{c.total}</td>
                    <td className="py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs flex flex-col gap-1.5 text-theme-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{totals.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Discount</span>
              <span>-{totals.totalDiscount}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Tax</span>
              <span>{totals.totalTax}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
              <span>Adjustment</span>
              <Input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value) || 0)}
                className="w-28 text-right"
              />
            </div>
            <div className="flex justify-between font-semibold text-gray-900 dark:text-white/90 pt-2 border-t border-gray-200 dark:border-gray-800">
              <span>Grand Total</span>
              <span>
                {currency} {totals.grandTotal}
              </span>
            </div>
            <p className="text-theme-xs text-gray-400 italic">
              Preview only — the server recomputes every total on save.
            </p>
          </div>
        </div>
      </section>

      {/* --- Terms --- */}
      <section className="rounded-2xl border border-gray-200 p-5 grid md:grid-cols-2 gap-4 dark:border-gray-800">
        <div className="md:col-span-2">
          <FormField label="Terms & Conditions">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                rows={3}
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Payment Terms">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. 50% advance, balance on delivery"
            />
          )}
        </FormField>
        <FormField label="Delivery Terms">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              placeholder="e.g. 4-6 weeks from PO"
            />
          )}
        </FormField>
        <FormField label="Carrier">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Delivery / Shipping Notes">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          )}
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Additional Notes">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* --- Actions --- */}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          disabled={saving_ || !existing}
          title={existing ? undefined : "Save the quote before printing"}
          onClick={() => {
            if (!existing) return;
            const opened = printQuotation(existing);
            if (!opened) {
              toast({
                title: "Pop-up blocked",
                description:
                  "Please allow pop-ups for this site, then try Print / PDF again.",
                variant: "error",
              });
            }
          }}
        >
          Print / PDF
        </Button>
        <Button
          variant="secondary"
          disabled={saving_}
          onClick={() => router.push("/crm/quotes")}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={saving_}
          loading={saving === "draft"}
          onClick={() => void handleSave("draft")}
        >
          Save Draft
        </Button>
        <Button
          variant="secondary"
          disabled={saving_}
          loading={saving === "saveNew"}
          onClick={() => void handleSave("saveNew")}
        >
          Save &amp; New
        </Button>
        <Button
          disabled={saving_}
          loading={saving === "save"}
          onClick={() => void handleSave("save")}
        >
          {isEdit ? "Save Changes" : "Create Quote"}
        </Button>
      </div>
    </div>
  );
}
