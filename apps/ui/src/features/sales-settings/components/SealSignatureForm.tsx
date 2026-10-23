"use client";

import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { sealSignatureSchema, type SealSignatureFormValues } from "../schema";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  fileToDataUri,
  validateImageFile,
} from "../utils";

export interface SealSignatureFormProps {
  /** Only meaningful for the Authorized Signature masterlist. */
  showSignatoryFields: boolean;
  onSubmit: (values: SealSignatureFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function SealSignatureForm({
  showSignatoryFields,
  onSubmit,
  onCancel,
  submitLabel,
}: SealSignatureFormProps) {
  const [values, setValues] = useState<SealSignatureFormValues>({
    title: "",
    signatoryName: "",
    designation: "",
    imageDataUri: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof SealSignatureFormValues>(
    key: K,
    value: SealSignatureFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, imageDataUri: validationError }));
      e.target.value = "";
      return;
    }
    setErrors((prev) => ({ ...prev, imageDataUri: "" }));
    const dataUri = await fileToDataUri(file);
    setField("imageDataUri", dataUri);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = sealSignatureSchema.safeParse(values);
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
      setSubmitError("Could not save this item. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Title" required error={errors.title}>
        {(fp) => (
          <Input
            {...fp}
            value={values.title}
            onChange={(e) => setField("title", e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      {showSignatoryFields ? (
        <>
          <FormField label="Signatory name" error={errors.signatoryName}>
            {(fp) => (
              <Input
                {...fp}
                value={values.signatoryName}
                onChange={(e) => setField("signatoryName", e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Designation" error={errors.designation}>
            {(fp) => (
              <Input
                {...fp}
                value={values.designation}
                onChange={(e) => setField("designation", e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </>
      ) : null}
      <FormField label="Image" required error={errors.imageDataUri}>
        {({ invalid: _invalid, ...fp }) => (
          <div className="flex items-center gap-4">
            {values.imageDataUri ? (
              <img
                src={values.imageDataUri}
                alt=""
                className="h-12 w-12 rounded-lg border border-gray-200 object-contain dark:border-gray-800"
              />
            ) : null}
            <input
              {...fp}
              type="file"
              accept={ACCEPTED_IMAGE_ACCEPT_ATTR}
              onChange={(e) => void handleFileChange(e)}
              disabled={submitting}
              className="text-theme-sm text-gray-600 dark:text-gray-300"
            />
          </div>
        )}
      </FormField>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        PNG or JPG, up to 5 MB.
      </p>
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
