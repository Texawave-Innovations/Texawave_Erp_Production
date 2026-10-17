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
import { previewRdc } from "../api";
import {
  emptyRdcLine,
  RDC_PURPOSES,
  rdcSchema,
  rdcToBody,
  type RdcFormValues,
  type RdcLineValues,
} from "../schema";
import type { ReturnableDcBody } from "../types";

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
 * The returnable DC form (goods lent, purpose and expected return date)
 * with its live A4 preview. Seal, signature and prepared-by default from
 * the master list's RETURNABLE_DC fields. Errors show in a bubble under
 * each field as it is left.
 */
export function RdcForm({
  mode,
  rdcId,
  rdcNumber,
  initialValues,
  customerLabel,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  rdcId?: number;
  rdcNumber?: string;
  initialValues: RdcFormValues;
  customerLabel?: string;
  onSubmit: (body: ReturnableDcBody) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<RdcFormValues>(initialValues);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(rdcSchema, values);
  const options = useMasterOptions("RETURNABLE_DC");

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

  const isValid = useCallback(
    (v: RdcFormValues) => rdcSchema.safeParse(v).success,
    [],
  );
  const request = useCallback(
    (v: RdcFormValues) => previewRdc(rdcToBody(v), rdcId),
    [rdcId],
  );
  const {
    preview,
    fresh,
    loading: previewing,
    error: previewError,
  } = useLivePreview(values, isValid, request);

  function set<K extends keyof RdcFormValues>(k: K, v: RdcFormValues[K]) {
    changed(String(k));
    setValues((s) => ({ ...s, [k]: v }));
  }
  function setLine(i: number, patch: Partial<RdcLineValues>) {
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
      await onSubmit(rdcToBody(values));
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === "CUSTOMER_INACTIVE") {
        setServerErrors({ customerId: e.message });
      }
      if (
        e instanceof ApiError &&
        e.errorCode === "RETURN_DATE_BEFORE_ISSUE_DATE"
      ) {
        setServerErrors({ expectedReturnDate: e.message });
      }
      setServerError(
        e instanceof ApiError ? e.message : "Could not save the returnable DC.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const number =
    mode === "edit" ? rdcNumber : (preview?.number ?? "Issued on save");

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
        aria-label={
          mode === "create" ? "New returnable DC" : "Edit returnable DC"
        }
      >
        {serverError ? (
          <Alert variant="error" title="The returnable DC was not saved">
            {serverError}
          </Alert>
        ) : null}

        <Section title="1. Recipient & dates">
          <FormField
            label="Recipient"
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
            <FormField label="RDC number">
              {(f) => <Input {...f} value={number ?? ""} readOnly />}
            </FormField>
            <FormField
              label="Issue date"
              required
              errorVariant="bubble"
              error={errorFor("issueDate")}
            >
              {(f) => (
                <DatePicker
                  {...f}
                  value={values.issueDate}
                  disabled={submitting}
                  onBlur={() => touch("issueDate")}
                  onChange={(e) => {
                    changed("expectedReturnDate");
                    set("issueDate", e.target.value);
                  }}
                />
              )}
            </FormField>
            <FormField
              label="Expected return date"
              required
              errorVariant="bubble"
              error={errorFor("expectedReturnDate")}
            >
              {(f) => (
                <DatePicker
                  {...f}
                  value={values.expectedReturnDate}
                  min={values.issueDate || undefined}
                  disabled={submitting}
                  onBlur={() => touch("expectedReturnDate")}
                  onChange={(e) => set("expectedReturnDate", e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Purpose"
              required
              errorVariant="bubble"
              error={errorFor("purpose")}
            >
              {(f) => (
                <Input
                  {...f}
                  maxLength={200}
                  list="rdc-purposes"
                  value={values.purpose}
                  disabled={submitting}
                  onBlur={() => touch("purpose")}
                  onChange={(e) => set("purpose", e.target.value)}
                />
              )}
            </FormField>
            <datalist id="rdc-purposes">
              {RDC_PURPOSES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <FormField
              label="Taken by / handed to"
              errorVariant="bubble"
              error={errorFor("takenBy")}
            >
              {(f) => (
                <Input
                  {...f}
                  maxLength={150}
                  value={values.takenBy}
                  disabled={submitting}
                  onBlur={() => touch("takenBy")}
                  onChange={(e) => set("takenBy", e.target.value)}
                />
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
                  <FormField
                    label="Description of goods"
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
                  lines: [...s.lines, emptyRdcLine()],
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
        </Section>

        <Section title="3. Seal, signature & terms">
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
                  list="rdc-prepared-by"
                  value={values.preparedBy}
                  disabled={submitting}
                  onBlur={() => touch("preparedBy")}
                  onChange={(e) => set("preparedBy", e.target.value)}
                />
              )}
            </FormField>
            <datalist id="rdc-prepared-by">
              {options.byField("PREPARED_BY").map((o) => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>
          </div>
          <FormField
            label="Returnable terms"
            errorVariant="bubble"
            error={errorFor("notes")}
            hint="Blank on a new returnable DC prints the standard terms."
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
            {mode === "create" ? "Save returnable DC" : "Save changes"}
          </Button>
        </div>
      </form>
      <div className="xl:sticky xl:top-4 xl:self-start">
        <DocumentPreviewPanel
          title="Returnable DC preview"
          html={preview?.html ?? null}
          loading={previewing}
          stale={!fresh}
          error={previewError}
          emptyMessage="Choose a recipient and fill in at least one item to see the returnable DC."
        />
      </div>
    </div>
  );
}
