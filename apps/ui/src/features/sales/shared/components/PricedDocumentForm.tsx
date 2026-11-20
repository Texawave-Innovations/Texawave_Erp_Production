"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  SectionCard,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import type { z } from "zod";
import type { BankDetails, DocumentPreview } from "../documents";
import { formatInr } from "../format";
import { GST_STATES } from "../gst";
import { useMasterOptions } from "../hooks";
import { useLivePreview } from "../useLivePreview";
import {
  emptyLine,
  type HeaderField,
  type LineFormValues,
  type PricedFormConfig,
  type PricedFormValues,
} from "../priced-form";
import { CustomerPicker } from "./CustomerPicker";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";

type Bank = (choice: string) => BankDetails | null;
type V = PricedFormValues;

/** API business errors → the field they belong to. */
const FIELD_OF_ERROR: Record<string, string> = {
  CUSTOMER_INACTIVE: "customerId",
  INVALID_MASTER_ITEM: "sealItemId",
};

function describeError(error: unknown, noun: string): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return `You don't have permission to save this ${noun}.`;
    }
    if (error.isValidationError) {
      return `The server rejected some values: ${error.fieldErrors.join("; ")}`;
    }
    return error.message;
  }
  return `Could not save the ${noun}. Check the fields and try again.`;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title} action={action}>
      {children}
    </SectionCard>
  );
}

export interface PricedDocumentFormProps {
  config: PricedFormConfig;
  /** `pricedFormSchema(header)` of the document type. */
  schema: z.ZodType<unknown, V>;
  mode: "create" | "edit";
  /** Edit: the saved document's number. */
  documentNumber?: string | undefined;
  initialValues: V;
  /** Edit: the stored bank block and customer label. */
  savedBank?: BankDetails | null | undefined;
  customerLabel?: string | undefined;
  /** Server pricing and HTML for the current values. */
  preview: (values: V, bank: Bank) => Promise<DocumentPreview>;
  onSubmit: (values: V, bank: Bank) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/**
 * The form of a priced Sales document with its live A4 preview beside it:
 * customer and header fields, items, charges and tax, bank / seal /
 * signatory and terms. The server prices and renders every change (600 ms
 * after typing stops); nothing is calculated here. Errors show in a bubble
 * under each field as it is left.
 */
export function PricedDocumentForm({
  config,
  schema,
  mode,
  documentNumber,
  initialValues,
  savedBank = null,
  customerLabel,
  preview: runPreview,
  onSubmit,
  onCancel,
  submitLabel,
}: PricedDocumentFormProps) {
  const [values, setValues] = useState<V>(initialValues);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(schema, values);
  const options = useMasterOptions(config.masterTypeOf(values.header));

  // New documents start with the master list's defaults.
  const defaultsApplied = useRef(mode === "edit");
  useEffect(() => {
    if (defaultsApplied.current || !options.data) return;
    defaultsApplied.current = true;
    const d = options.defaultOf;
    setValues((v) => ({
      ...v,
      header: withDefaults(v.header, config.headerFields, (f) =>
        f.masterField ? (d(f.masterField)?.label ?? "") : "",
      ),
      bankChoice: v.bankChoice || String(d("BANK_ACCOUNT")?.id ?? ""),
      sealItemId: v.sealItemId || String(d("COMPANY_SEAL")?.id ?? ""),
      signatureItemId:
        v.signatureItemId || String(d("AUTHORIZED_SIGNATURE")?.id ?? ""),
      preparedBy: v.preparedBy || (d("PREPARED_BY")?.label ?? ""),
    }));
  }, [options.data, options.defaultOf, config.headerFields]);

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
  const isValid = useCallback((v: V) => schema.safeParse(v).success, [schema]);
  const request = useCallback(
    (v: V) => runPreview(v, bank),
    [runPreview, bank],
  );
  const {
    preview,
    fresh,
    loading: previewing,
    error: previewError,
  } = useLivePreview(values, isValid, request);
  /** The preview of exactly the values on screen (else null). */
  const shown = fresh ? preview : null;

  function set<K extends keyof V>(key: K, value: V[K]) {
    changed(String(key));
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setHeader(key: string, value: string) {
    changed(`header.${key}`);
    setValues((v) => ({ ...v, header: { ...v.header, [key]: value } }));
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
      await onSubmit(values, bank);
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELD_OF_ERROR[error.errorCode] : undefined;
      if (field && error instanceof ApiError) {
        setServerErrors({ [field]: error.message });
      }
      setServerError(describeError(error, config.noun));
    } finally {
      setSubmitting(false);
    }
  }

  const text = (
    key:
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

  const number =
    mode === "edit" ? documentNumber : (preview?.number ?? "Issued on save");

  const hsnCodes = options
    .byField("HSN_CODE")
    .map((o) => o.value ?? "")
    .filter(Boolean);

  const masterLabels = (field: NonNullable<HeaderField["masterField"]>) =>
    options.byField(field).map((o) => o.label);

  const headerField = (f: HeaderField) => {
    const key = `header.${f.key}`;
    const value = values.header[f.key] ?? "";
    const fixed = mode === "edit" && Boolean(f.fixedOnEdit);
    return (
      <FormField
        key={f.key}
        label={f.label}
        required={f.required ?? false}
        errorVariant="bubble"
        error={errorFor(key)}
        {...(f.hint ? { hint: f.hint } : {})}
      >
        {(p) =>
          f.kind === "date" ? (
            <DatePicker
              {...p}
              placement="bottom"
              value={value}
              disabled={submitting || fixed}
              onBlur={() => touch(key)}
              onChange={(e) => setHeader(f.key, e.target.value)}
            />
          ) : f.kind === "select" ? (
            <Select
              {...p}
              value={value}
              disabled={submitting || fixed}
              onBlur={() => touch(key)}
              onChange={(e) => setHeader(f.key, e.target.value)}
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : f.masterField ? (
            <Select
              {...p}
              value={value}
              disabled={submitting || fixed}
              onBlur={() => touch(key)}
              onChange={(e) => setHeader(f.key, e.target.value)}
            >
              <option value="">Select…</option>
              {masterLabels(f.masterField).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
              {/* A saved value that is no longer in the master list stays selectable. */}
              {value && !masterLabels(f.masterField).includes(value) ? (
                <option value={value}>{value}</option>
              ) : null}
            </Select>
          ) : (
            <Input
              {...p}
              maxLength={f.maxLength}
              placeholder={f.placeholder}
              value={value}
              disabled={submitting || fixed}
              onBlur={() => touch(key)}
              onChange={(e) => setHeader(f.key, e.target.value)}
            />
          )
        }
      </FormField>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
        aria-label={`${mode === "create" ? "New" : "Edit"} ${config.noun}`}
      >
        {serverError ? (
          <Alert variant="error" title={`The ${config.noun} was not saved`}>
            {serverError}
          </Alert>
        ) : null}

        <Section title="1. Customer details">
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
        </Section>

        <Section title={`2. ${capitalize(config.noun)} details & line items`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={config.numberLabel}>
              {(f) => <Input {...f} value={number ?? ""} readOnly />}
            </FormField>
            {config.headerFields.map(headerField)}
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
          <h3 className="mt-1 text-theme-xs font-bold tracking-wider text-gray-600 uppercase dark:text-gray-300">
            Line items ({values.lines.length})
          </h3>
          {errorFor("lines") ? (
            <p role="alert" className="text-theme-sm text-error-600">
              {errorFor("lines")}
            </p>
          ) : null}
          {values.lines.map((l, i) => {
            const err = (k: string) => errorFor(`lines.${i}.${k}`);
            const amount = shown ? shown.totals.lineAmounts[i] : undefined;
            return (
              <fieldset
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <legend className="rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  Item {i + 1}
                </legend>
                <div>
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
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <FormField
                    label="HSN code"
                    errorVariant="bubble"
                    error={err("hsnCode")}
                  >
                    {(f) => (
                      <Select
                        {...f}
                        value={l.hsnCode}
                        disabled={submitting}
                        onBlur={() => touch(`lines.${i}.hsnCode`)}
                        onChange={(e) =>
                          setLine(i, { hsnCode: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {hsnCodes.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                        {/* A saved code that is no longer in the master list stays selectable. */}
                        {l.hsnCode && !hsnCodes.includes(l.hsnCode) ? (
                          <option value={l.hsnCode}>{l.hsnCode}</option>
                        ) : null}
                      </Select>
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
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                  <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                    Calculated row amount:{" "}
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {amount ? formatInr(amount) : "—"}
                    </span>
                  </p>
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
          <Button
            type="button"
            variant="secondary"
            className="w-full border-dashed"
            disabled={submitting || values.lines.length >= 200}
            onClick={() =>
              setValues((v) => ({ ...v, lines: [...v.lines, emptyLine()] }))
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Add item
          </Button>
        </Section>

        <Section title="3. Tax & transport charges">
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
          {shown ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-gray-50 p-4 text-theme-sm dark:bg-gray-800/60">
              <dt className="text-gray-500 dark:text-gray-400">Subtotal</dt>
              <dd className="text-right">
                {formatInr(shown.totals.itemsSubtotal)}
              </dd>
              {shown.totals.taxMode === "INTRA" ? (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">
                    CGST @ {Number(shown.totals.cgstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(shown.totals.cgstAmount)}
                  </dd>
                  <dt className="text-gray-500 dark:text-gray-400">
                    SGST @ {Number(shown.totals.sgstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(shown.totals.sgstAmount)}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-gray-500 dark:text-gray-400">
                    IGST @ {Number(shown.totals.igstRate)}%
                  </dt>
                  <dd className="text-right">
                    {formatInr(shown.totals.igstAmount)}
                  </dd>
                </>
              )}
              <dt className="text-gray-500 dark:text-gray-400">Round off</dt>
              <dd className="text-right">{formatInr(shown.totals.roundOff)}</dd>
              <dt className="font-semibold text-gray-900 dark:text-white/90">
                Total
              </dt>
              <dd className="text-right font-semibold text-gray-900 dark:text-white/90">
                {formatInr(shown.totals.totalAmount)}
              </dd>
            </dl>
          ) : (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Totals are calculated by the server and appear with the preview.
            </p>
          )}
        </Section>

        <Section title="4. Banking, seal, signature & terms">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 md:col-span-2">
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
                        As saved — {savedBank.bankName}{" "}
                        {savedBank.accountNumber}
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
              {bank(values.bankChoice) ? (
                <p className="rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    Bank:
                  </span>{" "}
                  {bank(values.bankChoice)?.bankName ?? "—"} |{" "}
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    Acc:
                  </span>{" "}
                  {bank(values.bankChoice)?.accountNumber ?? "—"}
                  <br />
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    Branch:
                  </span>{" "}
                  {bank(values.bankChoice)?.branch ?? "—"} |{" "}
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    IFSC:
                  </span>{" "}
                  {bank(values.bankChoice)?.ifsc ?? "—"}
                </p>
              ) : null}
            </div>
            <FormField
              label="Prepared by"
              errorVariant="bubble"
              error={errorFor("preparedBy")}
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.preparedBy}
                  disabled={submitting}
                  onBlur={() => touch("preparedBy")}
                  onChange={(e) => set("preparedBy", e.target.value)}
                >
                  <option value="">Select…</option>
                  {options.byField("PREPARED_BY").map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                  {/* A saved name that is no longer in the master list stays selectable. */}
                  {values.preparedBy &&
                  !options
                    .byField("PREPARED_BY")
                    .some((o) => o.label === values.preparedBy) ? (
                    <option value={values.preparedBy}>
                      {values.preparedBy}
                    </option>
                  ) : null}
                </Select>
              )}
            </FormField>
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

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-3 shadow-theme-md backdrop-blur dark:border-slate-800 dark:bg-gray-dark/95">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Total{" "}
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white/90">
              {shown ? formatInr(shown.totals.totalAmount) : "—"}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <DocumentPreviewPanel
          title={`${capitalize(config.noun)} preview`}
          html={preview?.html ?? null}
          loading={previewing}
          stale={!fresh}
          error={previewError}
          emptyMessage={`Choose a customer and fill in at least one item to see the ${config.noun}.`}
        />
      </div>
    </div>
  );
}

const capitalize = (v: string) => (v ? v[0]?.toUpperCase() + v.slice(1) : v);

/** Empty header text fields take the master list's default; typed values stay. */
function withDefaults(
  header: Record<string, string>,
  fields: readonly HeaderField[],
  defaultFor: (f: HeaderField) => string,
): Record<string, string> {
  const next = { ...header };
  for (const f of fields) {
    if (f.kind === "text" && f.masterField && !next[f.key]) {
      next[f.key] = defaultFor(f);
    }
  }
  return next;
}
