"use client";

import { Button, FormField, Input, Textarea } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  createProposalTemplateSchema,
  type CreateProposalTemplateFormValues,
} from "../schema";

export interface ProposalTemplateFormProps {
  initialValues?: Partial<CreateProposalTemplateFormValues>;
  onSubmit: (values: CreateProposalTemplateFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function ProposalTemplateForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ProposalTemplateFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [department, setDepartment] = useState(initialValues?.department ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createProposalTemplateSchema.safeParse({
      name,
      title,
      code: code || undefined,
      department: department || undefined,
      description: description || undefined,
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
        "Could not save this template. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Name" required error={errors.name}>
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
        <FormField label="Title" required error={errors.title}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Code">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Department">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <FormField label="Description">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

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
