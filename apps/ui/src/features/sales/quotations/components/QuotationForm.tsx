"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CustomerPicker } from "../../shared/components/CustomerPicker";
import { DocumentPreviewPanel } from "../../shared/components/DocumentPreviewPanel";
import type { BankDetails, DocumentPreview } from "../../shared/documents";
import { formatInr } from "../../shared/format";
import { GST_STATES } from "../../shared/gst";
import { useMasterOptions } from "../../shared/hooks";
import { previewQuotation } from "../api";
import { useNextQuotationNumber } from "../hooks";
import {
  emptyLine,
  formToBody,
  quotationSchema,
  type LineFormValues,
  type QuotationFormValues,
} from "../schema";
import type { QuotationBody } from "../types";

/** API business errors → the field they belong to. */
const FIELD_OF_ERROR: Record<string, string> = {
  CUSTOMER_INACTIVE: "customerId",
  INVALID_MASTER_ITEM: "sealItemId",
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to save quotations.";
    }
    if (error.isValidationError) {
      return `The server rejected some values: ${error.fieldErrors.join("; ")}`;
    }
    return error.message;
  }
  return "Could not save the quotation. Check the fields and try again.";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {children}
    </Card>
  );
}

export interface QuotationFormProps {
  mode: "create" | "edit";
  /** Edit: the saved quotation's id and number. */
  quotationId?: number;
  quotationNumber?: string;
  initialValues: QuotationFormValues;
  /** Edit: the stored bank block and customer label. */
  savedBank?: BankDetails | null;
  customerLabel?: string;
  onSubmit: (body: QuotationBody) => Promise<void>;
  onCancel: () => void;
}

export function QuotationForm({
  mode,
  quotationId,
  quotationNumber,
  initialValues,
  savedBank = null,
  customerLabel,
  onSubmit,
  onCancel,
}: QuotationFormProps) {
  const [values, setValues] = useState<QuotationFormValues>(initialValues);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(quotationSchema, values);
  const options = useMasterOptions("QUOTATION");
  const nextNumber = useNextQuotationNumber(
    values.quotationDate,
    mode === "create",
  );

  // New quotations start with the master list's defaults.
  const defaultsApplied = useRef(mode === "edit");
  useEffect(() => {
    if (defaultsApplied.current || !options.data) return;
    defaultsApplied.current = true;
    const d = options.defaultOf;
    setValues((v) => ({
      ...v,
      validity: v.validity || (d("VALIDITY")?.label ?? ""),
      deliveryTerms: v.deliveryTerms || (d("DELIVERY_TERMS")?.label ?? ""),
      bankChoice: v.bankChoice || String(d("BANK_ACCOUNT")?.id ?? ""),
      sealItemId: v.sealItemId || String(d("COMPANY_SEAL")?.id ?? ""),
      signatureItemId:
        v.signatureItemId || String(d("AUTHORIZED_SIGNATURE")?.id ?? ""),
      preparedBy: v.preparedBy || (d("PREPARED_BY")?.label ?? ""),
    }));
  }, [options.data, options.defaultOf]);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  );
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);

  const bankOptions = options.data;
  const bank = useCallback(
    (choice: string): BankDetails | null => {
      if (choice === "") return null;
      if (choice === "saved") return savedBank;
      return (
        (bankOptions ?? []).find(
          (o) => o.field === "BANK_ACCOUNT" && String(o.id) === choice,
        )?.bankDetails ?? null
      );
    },
    [bankOptions, savedBank],
  );

  // --- Live preview: the server prices and renders the unsaved values.
  const debounced = useDebouncedValue(values, 600);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewSeq = useRef(0);
  const valid = quotationSchema.safeParse(debounced).success;
  const debouncedKey = JSON.stringify(debounced);
  useEffect(() => {
    if (!valid) return;
    const seq = ++previewSeq.current;
    setPreviewing(true);
    previewQuotation(formToBody(debounced, bank), quotationId)
      .then((p) => {
        if (seq !== previewSeq.current) return;
        setPreview(p);
        setPreviewFor(debouncedKey);
        setPreviewError(null);
      })
      .catch((e: unknown) => {
        if (seq !== previewSeq.current) return;
        setPreviewError(
          e instanceof ApiError ? e.message : "The preview could not load.",
        );
      })
      .finally(() => {
        if (seq === previewSeq.current) setPreviewing(false);
      });
  }, [debounced, debouncedKey, valid, quotationId, bank]);
  const fresh = preview !== null && previewFor === JSON.stringify(values);

  function set<K extends keyof QuotationFormValues>(
    key: K,
    value: QuotationFormValues[K],
  ) {
    changed(String(key));
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setLine(index: number, patch: Partial<LineFormValues>) {
    for (const k of Object.keys(patch)) changed(`lines.${index}.${k}`);
    setValues((v) => ({
      ...v,
      lines: v.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateAll()) {
      setServerError("Fix the highlighted fields and try again.");
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(formToBody(values, bank));
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELD_OF_ERROR[error.errorCode] : undefined;
      if (field && error instanceof ApiError) {
        setServerErrors({ [field]: error.message });
      }
      setServerError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const text = (
    key:
      | "validity"
      | "deliveryTerms"
      | "transportDescription"
      | "transportCharge"
      | "transportHsn"
      | "cgstRate"
      | "sgstRate"
      | "igstRate"
      | "preparedBy",
    label: string,
    opts: {
      placeholder?: string;
      hint?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      maxLength?: number;
      list?: string;
    } = {},
  ) => (
    <FormField
      label={label}
      errorVariant="bubble"
      error={errorFor(key)}
      {...(opts.hint ? { hint: opts.hint } : {})}
    >
      {(f) => (
        <Input
          {...f}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength}
          placeholder={opts.placeholder}
          list={opts.list}
          value={values[key]}
          disabled={submitting}
          onBlur={() => touch(key)}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </FormField>
  );

  const datalist = (id: string, labels: string[]) => (
    <datalist id={id}>
      {labels.map((l) => (
        <option key={l} value={l} />
      ))}
    </datalist>
  );

  const number = mode === "edit" ? quotationNumber : (nextNumber.data ?? "…");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
        aria-label={mode === "create" ? "New quotation" : "Edit quotation"}
      >
        {serverError ? (
          <Alert variant="error" title="Quotation not saved">
            {serverError}
          </Alert>
        ) : null}

        <Section title="1. Customer & quotation">
          <FormField
            label="Customer"
            required
            errorVariant="bubble"
            error={errorFor("customerId")}
          >
            {(f) => (
              <CustomerPicker
                id={f.id}
                describedBy={f["aria-describedby"]}
                invalid={f.invalid}
                value={values.customerId}
                selectedLabel={customerLabel}
                disabled={submitting}
                onBlur={() => touch("customerId")}
                onChange={(id) => set("customerId", id)}
              />
            )}
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Quotation number" hint="Issued on save">
              {(f) => <Input {...f} value={number ?? ""} readOnly />}
            </FormField>
            <FormField
              label="Quotation date"
              required
              errorVariant="bubble"
              error={errorFor("quotationDate")}
            >
              {(f) => (
                <DatePicker
                  {...f}
                  value={values.quotationDate}
                  disabled={submitting}
                  onBlur={() => touch("quotationDate")}
                  onChange={(e) => set("quotationDate", e.target.value)}
                />
              )}
            </FormField>
            {text("validity", "Validity", {
              placeholder: "30 Days",
              maxLength: 50,
              list: "quotation-validity",
            })}
            {text("deliveryTerms", "Delivery terms", {
              placeholder: "2-3 Weeks",
              maxLength: 200,
              list: "quotation-delivery-terms",
            })}
            {datalist(
              "quotation-validity",
              options.byField("VALIDITY").map((o) => o.label),
            )}
            {datalist(
              "quotation-delivery-terms",
              options.byField("DELIVERY_TERMS").map((o) => o.label),
            )}
            <FormField
              label="Place of supply"
              errorVariant="bubble"
              error={errorFor("placeOfSupply")}
              hint="Blank = the customer's GST state. Same as yours → CGST + SGST, else IGST."
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.placeOfSupply}
                  disabled={submitting}
                  onBlur={() => touch("placeOfSupply")}
                  onChange={(e) => set("placeOfSupply", e.target.value)}
                >
                  <option value="">Customer&apos;s state</option>
                  {GST_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        </Section>

        <Section title="2. Items">
          {errorFor("lines") ? (
            <p role="alert" className="text-theme-sm text-error-600">
              {errorFor("lines")}
            </p>
          ) : null}
          {datalist(
            "quotation-hsn",
            options
              .byField("HSN_CODE")
              .map((o) => o.value ?? "")
              .filter(Boolean),
          )}
          {values.lines.map((l, i) => {
            const err = (k: string) => errorFor(`lines.${i}.${k}`);
            const amount = fresh ? preview.totals.lineAmounts[i] : undefined;
            return (
              <fieldset
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <legend className="px-1 text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
                  Item {i + 1}
                </legend>
                <FormField
                  label="Description"
                  required
                  errorVariant="bubble"
                  error={err("description")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      maxLength={500}
                      placeholder="Industrial control panel"
                      value={l.description}
                      disabled={submitting}
                      onBlur={() => touch(`lines.${i}.description`)}
                      onChange={(e) =>
                        setLine(i, { description: e.target.value })
                      }
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <FormField
                    label="HSN code"
                    errorVariant="bubble"
                    error={err("hsnCode")}
                  >
                    {(f) => (
                      <Input
                        {...f}
                        inputMode="numeric"
                        maxLength={8}
                        list="quotation-hsn"
                        value={l.hsnCode}
                        disabled={submitting}
                        onBlur={() => touch(`lines.${i}.hsnCode`)}
                        onChange={(e) =>
                          setLine(i, { hsnCode: e.target.value })
                        }
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Quantity"
                    required
                    errorVariant="bubble"
                    error={err("quantity")}
                  >
                    {(f) => (
                      <Input
                        {...f}
                        inputMode="decimal"
                        value={l.quantity}
                        disabled={submitting}
                        onBlur={() => touch(`lines.${i}.quantity`)}
                        onChange={(e) =>
                          setLine(i, { quantity: e.target.value })
                        }
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Unit price (₹)"
                    required
                    errorVariant="bubble"
                    error={err("unitPrice")}
                  >
                    {(f) => (
                      <Input
                        {...f}
                        inputMode="decimal"
                        value={l.unitPrice}
                        disabled={submitting}
                        onBlur={() => touch(`lines.${i}.unitPrice`)}
                        onChange={(e) =>
                          setLine(i, { unitPrice: e.target.value })
                        }
                      />
                    )}
                  </FormField>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-theme-sm font-medium text-gray-700 dark:text-white/90">
                      Amount
                    </span>
                    <span className="flex h-11 items-center text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                      {amount ? formatInr(amount) : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting || values.lines.length === 1}
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        lines: v.lines.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={submitting || values.lines.length >= 200}
              onClick={() =>
                setValues((v) => ({ ...v, lines: [...v.lines, emptyLine()] }))
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
        </Section>

        <Section title="3. Charges & tax">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {text("transportDescription", "Transport description", {
              placeholder: "Freight & Transportation Charges",
              maxLength: 200,
            })}
            {text("transportCharge", "Transport charge (₹)", {
              inputMode: "decimal",
            })}
            {text("transportHsn", "Transport HSN", {
              inputMode: "numeric",
              maxLength: 8,
            })}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {text("cgstRate", "CGST %", {
              inputMode: "decimal",
              maxLength: 6,
              hint: "Blank = the customer's rate",
            })}
            {text("sgstRate", "SGST %", { inputMode: "decimal", maxLength: 6 })}
            {text("igstRate", "IGST %", {
              inputMode: "decimal",
              maxLength: 6,
              hint: "Inter-state; blank = CGST + SGST",
            })}
          </div>
          {fresh ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-gray-50 p-4 text-theme-sm dark:bg-gray-800/60">
              <dt className="text-gray-500 dark:text-gray-400">Subtotal</dt>
              <dd className="text-right">
                {formatInr(preview.totals.itemsSubtotal)}
              </dd>
              {preview.totals.taxMode === "INTRA" ? (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">
                    CGST @ {Number(preview.totals.cgstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(preview.totals.cgstAmount)}
                  </dd>
                  <dt className="text-gray-500 dark:text-gray-400">
                    SGST @ {Number(preview.totals.sgstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(preview.totals.sgstAmount)}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">
                    IGST @ {Number(preview.totals.igstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(preview.totals.igstAmount)}
                  </dd>
                </>
              )}
              <dt className="text-gray-500 dark:text-gray-400">Round off</dt>
              <dd className="text-right">
                {formatInr(preview.totals.roundOff)}
              </dd>
              <dt className="font-semibold text-gray-900 dark:text-white/90">
                Total
              </dt>
              <dd className="text-right font-semibold text-gray-900 dark:text-white/90">
                {formatInr(preview.totals.totalAmount)}
              </dd>
            </dl>
          ) : (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Totals are calculated by the server and appear with the preview.
            </p>
          )}
        </Section>

        <Section title="4. Bank, seal & signatory">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Bank account"
              errorVariant="bubble"
              error={errorFor("bankChoice")}
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.bankChoice}
                  disabled={submitting}
                  onChange={(e) => set("bankChoice", e.target.value)}
                >
                  <option value="">None</option>
                  {savedBank ? (
                    <option value="saved">
                      As saved — {savedBank.bankName} {savedBank.accountNumber}
                    </option>
                  ) : null}
                  {options.byField("BANK_ACCOUNT").map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {text("preparedBy", "Prepared by", {
              maxLength: 150,
              list: "quotation-prepared-by",
            })}
            {datalist(
              "quotation-prepared-by",
              options.byField("PREPARED_BY").map((o) => o.label),
            )}
            <FormField
              label="Company seal"
              errorVariant="bubble"
              error={errorFor("sealItemId")}
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.sealItemId}
                  disabled={submitting}
                  onChange={(e) => set("sealItemId", e.target.value)}
                >
                  <option value="">None</option>
                  {options.byField("COMPANY_SEAL").map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Authorized signature">
              {(f) => (
                <Select
                  {...f}
                  value={values.signatureItemId}
                  disabled={submitting}
                  onChange={(e) => set("signatureItemId", e.target.value)}
                >
                  <option value="">None</option>
                  {options.byField("AUTHORIZED_SIGNATURE").map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <FormField
            label="Terms & conditions"
            errorVariant="bubble"
            error={errorFor("terms")}
            hint="One per line."
          >
            {(f) => (
              <Textarea
                {...f}
                rows={4}
                value={values.terms}
                disabled={submitting}
                onBlur={() => touch("terms")}
                onChange={(e) => set("terms", e.target.value)}
              />
            )}
          </FormField>
        </Section>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "Save quotation" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <DocumentPreviewPanel
          title="Quotation preview"
          html={preview?.html ?? null}
          loading={previewing}
          stale={!fresh}
          error={previewError}
          emptyMessage="Choose a customer and fill in at least one item to see the quotation."
        />
      </div>
    </div>
  );
}
