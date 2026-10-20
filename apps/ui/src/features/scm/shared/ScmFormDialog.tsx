"use client";

import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  type DialogSize,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ProductSelect, WarehouseSelect } from "./masters";

import { ScmPanel } from "./ScmPanel";
export interface ScmField {
  name: string;
  label: string;
  type:
    | "text"
    | "number"
    | "textarea"
    | "date"
    | "select"
    | "product"
    | "warehouse";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Options computed from the other fields (dependent selects). */
  dynamicOptions?: (
    values: ScmFormValues,
  ) => ReadonlyArray<{ value: string; label: string }>;
  /** Hide the field unless this returns true. */
  visibleWhen?: (values: ScmFormValues) => boolean;
  min?: number;
  max?: number;
  step?: number;
  /** 2 = spans both columns. */
  span?: 1 | 2;
  upper?: boolean;
  mono?: boolean;
}

export type ScmFormValues = Record<string, string | number | "">;

export interface ScmFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: DialogSize;
  fields: readonly ScmField[];
  initialValues?: Partial<ScmFormValues>;
  submitLabel: string;
  /** Return an error per field name (or `_form`) to block submit. */
  validate?: (values: ScmFormValues) => Record<string, string> | null;
  /** Receives values with number/product/warehouse fields as numbers and
   * blank optional fields as `undefined`. Throw to show a submit error. */
  onSubmit: (
    values: Record<string, string | number | undefined>,
  ) => Promise<void>;
}

function blank(fields: readonly ScmField[], initial?: Partial<ScmFormValues>) {
  const out: ScmFormValues = {};
  for (const f of fields) out[f.name] = initial?.[f.name] ?? "";
  return out;
}

/** Config-driven create/edit dialog shared by the simple SCM forms. Keeps
 * entered values when the server rejects the save (Docs/DESIGN_SYSTEM.md). */
export function ScmFormDialog(props: ScmFormDialogProps) {
  return (
    <ScmPanel
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      size={props.size ?? "lg"}
    >
      {props.open ? <FormBody {...props} /> : null}
    </ScmPanel>
  );
}

function FormBody({
  fields,
  initialValues,
  submitLabel,
  description,
  validate,
  onSubmit,
  onClose,
}: ScmFormDialogProps) {
  const [values, setValues] = useState<ScmFormValues>(() =>
    blank(fields, initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set(name: string, value: string | number | "") {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    for (const f of fields) {
      if (f.visibleWhen && !f.visibleWhen(values)) continue;
      const raw = values[f.name];
      if (f.required && (raw === "" || raw === undefined)) {
        found[f.name] = `${f.label} is required`;
      } else if (f.type === "number" && raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n)) found[f.name] = `${f.label} must be a number`;
        else if (f.min !== undefined && n < f.min)
          found[f.name] = `${f.label} must be at least ${f.min}`;
        else if (f.max !== undefined && n > f.max)
          found[f.name] = `${f.label} must be at most ${f.max}`;
      }
    }
    Object.assign(found, validate?.(values) ?? {});
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitError(null);
    const out: Record<string, string | number | undefined> = {};
    for (const f of fields) {
      const raw = values[f.name];
      if (raw === "" || raw === undefined) out[f.name] = undefined;
      else if (
        f.type === "number" ||
        f.type === "product" ||
        f.type === "warehouse"
      )
        out[f.name] = Number(raw);
      else out[f.name] = typeof raw === "string" ? raw.trim() : raw;
    }
    setSubmitting(true);
    try {
      await onSubmit(out);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {description ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields
          .filter((f) => !f.visibleWhen || f.visibleWhen(values))
          .map((f) => (
            <div
              key={f.name}
              className={f.span === 2 ? "sm:col-span-2" : undefined}
            >
              <FormField
                label={f.label}
                required={f.required ?? false}
                error={errors[f.name]}
                hint={f.hint}
              >
                {(p) => {
                  const value = values[f.name] ?? "";
                  if (f.type === "textarea") {
                    return (
                      <Textarea
                        {...p}
                        invalid={p.invalid}
                        rows={2}
                        value={String(value)}
                        placeholder={f.placeholder}
                        onChange={(e) => set(f.name, e.target.value)}
                        disabled={submitting}
                      />
                    );
                  }
                  if (f.type === "select") {
                    return (
                      <Select
                        {...p}
                        value={String(value)}
                        onChange={(e) => set(f.name, e.target.value)}
                        disabled={submitting}
                      >
                        {!f.required || value === "" ? (
                          <option value="">{f.placeholder ?? "Select"}</option>
                        ) : null}
                        {(f.dynamicOptions
                          ? f.dynamicOptions(values)
                          : (f.options ?? [])
                        ).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  if (f.type === "product") {
                    return (
                      <ProductSelect
                        {...p}
                        value={value === "" ? "" : Number(value)}
                        onChange={(n) => set(f.name, n)}
                        disabled={submitting}
                      />
                    );
                  }
                  if (f.type === "warehouse") {
                    return (
                      <WarehouseSelect
                        {...p}
                        value={value === "" ? "" : Number(value)}
                        onChange={(n) => set(f.name, n)}
                        disabled={submitting}
                      />
                    );
                  }
                  return (
                    <Input
                      {...p}
                      invalid={p.invalid}
                      type={
                        f.type === "number"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : "text"
                      }
                      value={String(value)}
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      className={[
                        f.mono ? "font-mono" : "",
                        f.upper ? "uppercase" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onChange={(e) =>
                        set(
                          f.name,
                          f.upper
                            ? e.target.value.toUpperCase()
                            : e.target.value,
                        )
                      }
                      disabled={submitting}
                    />
                  );
                }}
              </FormField>
            </div>
          ))}
      </div>
      {errors._form ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {errors._form}
        </p>
      ) : null}
      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
