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
import { CustomerPicker } from "../../shared/components/CustomerPicker";
import { DocumentPreviewPanel } from "../../shared/components/DocumentPreviewPanel";
import { useMasterOptions } from "../../shared/hooks";
import { useLivePreview } from "../../shared/useLivePreview";
import { previewChallan } from "../api";
import {
  challanSchema,
  challanToBody,
  emptyChallanLine,
  type ChallanFormValues,
  type ChallanLineValues,
} from "../schema";
import type { DeliveryChallanBody } from "../types";

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

/**
 * The delivery challan form (items and quantities, no prices) with its live
 * A4 preview. Errors show in a bubble under each field as it is left.
 */
export function ChallanForm({
  mode,
  challanId,
  challanNumber,
  initialValues,
  customerLabel,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  challanId?: number;
  challanNumber?: string;
  initialValues: ChallanFormValues;
  customerLabel?: string;
  onSubmit: (body: DeliveryChallanBody) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ChallanFormValues>(initialValues);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(challanSchema, values);
  const options = useMasterOptions("DELIVERY_CHALLAN");

  const defaultsApplied = useRef(mode === "edit");
  useEffect(() => {
    if (defaultsApplied.current || !options.data) return;
    defaultsApplied.current = true;
    const d = options.defaultOf;
    setValues((v) => ({
      ...v,
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

  // Live preview (no prices for a challan).
  const isValid = useCallback(
    (v: ChallanFormValues) => challanSchema.safeParse(v).success,
    [],
  );
  const request = useCallback(
    (v: ChallanFormValues) => previewChallan(challanToBody(v), challanId),
    [challanId],
  );
  const {
    preview,
    fresh,
    loading: previewing,
    error: previewError,
  } = useLivePreview(values, isValid, request);

  function set<K extends keyof ChallanFormValues>(
    k: K,
    v: ChallanFormValues[K],
  ) {
    changed(String(k));
    setValues((s) => ({ ...s, [k]: v }));
  }
  function setLine(i: number, patch: Partial<ChallanLineValues>) {
    for (const k of Object.keys(patch)) changed(`lines.${i}.${k}`);
    setValues((s) => ({
      ...s,
      lines: s.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
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
      await onSubmit(challanToBody(values));
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === "CUSTOMER_INACTIVE") {
        setServerErrors({ customerId: e.message });
      }
      setServerError(
        e instanceof ApiError ? e.message : "Could not save the challan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const number =
    mode === "edit" ? challanNumber : (preview?.number ?? "Issued on save");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
        aria-label={
          mode === "create" ? "New delivery challan" : "Edit delivery challan"
        }
      >
        {serverError ? (
          <Alert variant="error" title="The challan was not saved">
            {serverError}
          </Alert>
        ) : null}

        <Section title="1. Consignee & challan">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField label="DC number">
              {(f) => <Input {...f} value={number ?? ""} readOnly />}
            </FormField>
            <FormField
              label="DC date"
              required
              errorVariant="bubble"
              error={errorFor("dcDate")}
            >
              {(f) => (
                <DatePicker
                  {...f}
                  value={values.dcDate}
                  disabled={submitting}
                  onBlur={() => touch("dcDate")}
                  onChange={(e) => set("dcDate", e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Status">
              {(f) => (
                <Select
                  {...f}
                  value={values.status}
                  disabled={submitting}
                  onChange={(e) =>
                    set("status", e.target.value as ChallanFormValues["status"])
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="DISPATCHED">Dispatched</option>
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
          <datalist id="challan-hsn">
            {options
              .byField("HSN_CODE")
              .map((o) => o.value ?? "")
              .filter(Boolean)
              .map((v) => (
                <option key={v} value={v} />
              ))}
          </datalist>
          {values.lines.map((l, i) => {
            const err = (k: string) => errorFor(`lines.${i}.${k}`);
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
                      value={l.description}
                      disabled={submitting}
                      onBlur={() => touch(`lines.${i}.description`)}
                      onChange={(e) =>
                        setLine(i, { description: e.target.value })
                      }
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-3">
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
                        list="challan-hsn"
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
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting || values.lines.length === 1}
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() =>
                      setValues((s) => ({
                        ...s,
                        lines: s.lines.filter((_, j) => j !== i),
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
                setValues((s) => ({
                  ...s,
                  lines: [...s.lines, emptyChallanLine()],
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
        </Section>

        <Section title="3. Seal, signature & note">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField label="Company seal">
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
            <FormField
              label="Prepared by"
              errorVariant="bubble"
              error={errorFor("preparedBy")}
            >
              {(f) => (
                <Input
                  {...f}
                  maxLength={150}
                  list="challan-prepared-by"
                  value={values.preparedBy}
                  disabled={submitting}
                  onBlur={() => touch("preparedBy")}
                  onChange={(e) => set("preparedBy", e.target.value)}
                />
              )}
            </FormField>
            <datalist id="challan-prepared-by">
              {options.byField("PREPARED_BY").map((o) => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>
          </div>
          <FormField
            label="Note"
            errorVariant="bubble"
            error={errorFor("notes")}
            hint="Blank on a new challan prints the standard note."
          >
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                value={values.notes}
                disabled={submitting}
                onBlur={() => touch("notes")}
                onChange={(e) => set("notes", e.target.value)}
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
            {mode === "create" ? "Save challan" : "Save changes"}
          </Button>
        </div>
      </form>
      <div className="xl:sticky xl:top-4 xl:self-start">
        <DocumentPreviewPanel
          title="Delivery challan preview"
          html={preview?.html ?? null}
          loading={previewing}
          stale={!fresh}
          error={previewError}
          emptyMessage="Choose a customer and fill in at least one item to see the challan."
        />
      </div>
    </div>
  );
}
