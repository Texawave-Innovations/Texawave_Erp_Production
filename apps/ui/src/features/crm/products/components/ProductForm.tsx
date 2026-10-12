"use client";

import {
  createProductSchema,
  type CreateProductFormValues,
} from "@texawave-erp/core";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface ProductFormProps {
  initialValues?: Partial<CreateProductFormValues>;
  onSubmit: (values: CreateProductFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Reproduces legacy Products.tsx's create/edit form fields exactly:
 * Name, Code/SKU (both required, `code` has no uniqueness check — see
 * Docs/CRM_PRODUCTS_LEGACY_PARITY.md §4 decision D1), Category, Vendor,
 * Unit Price (rejects negative — decision D3), Tax %, Description, and
 * an Active toggle (a `Checkbox` here; `ui-kit` has no `Switch`
 * component, per the audit's UI-parity checklist). */
export function ProductForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [category, setCategory] = useState(initialValues?.category ?? "");
  const [vendor, setVendor] = useState(initialValues?.vendor ?? "");
  const [unitPrice, setUnitPrice] = useState(
    initialValues?.unitPrice !== undefined
      ? String(initialValues.unitPrice)
      : "0",
  );
  const [taxPercent, setTaxPercent] = useState(
    initialValues?.taxPercent !== undefined
      ? String(initialValues.taxPercent)
      : "",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createProductSchema.safeParse({
      name,
      code,
      category: category || undefined,
      vendor: vendor || undefined,
      unitPrice: unitPrice === "" ? undefined : Number(unitPrice),
      taxPercent: taxPercent === "" ? undefined : Number(taxPercent),
      description: description || undefined,
      isActive,
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
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError(
        "Could not save this product. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Product Name" required error={errors.name}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Code / SKU" required error={errors.code}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
              placeholder="SKU-1001"
            />
          )}
        </FormField>
        <FormField label="Category" error={errors.category}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Vendor" error={errors.vendor}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Unit Price" required error={errors.unitPrice}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              invalid={fieldProps.invalid}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Tax %" error={errors.taxPercent}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              invalid={fieldProps.invalid}
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <FormField label="Description" error={errors.description}>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            invalid={fieldProps.invalid}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <span className="text-theme-sm text-gray-700 dark:text-gray-300">
          Active
        </span>
        <Checkbox
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={submitting}
        />
      </label>
      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {submitError}
        </p>
      ) : null}
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
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
