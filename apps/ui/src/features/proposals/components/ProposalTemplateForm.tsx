"use client";

import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useDepartments } from "@/features/departments/hooks";
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
  const [code, setCode] = useState(initialValues?.code ?? "");
  // New templates always start at V1 / Active (Docs/PROJECTS_MODULE_SPEC.md
  // versioning model) — shown here for parity with old ERP's form but not
  // part of CreateProposalTemplateDto, so never sent to the API.
  const [version, setVersion] = useState("V1");
  const [status, setStatus] = useState("active");
  const [department, setDepartment] = useState(initialValues?.department ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const departmentsQuery = useDepartments();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setErrors({ code: "Template code is required" });
      return;
    }
    const result = createProposalTemplateSchema.safeParse({
      name,
      title: name,
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
      <FormField label="Template Name" required error={errors.name}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            invalid={fieldProps.invalid}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mechanical Engineering Proposal"
            disabled={submitting}
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Template Code" required error={errors.code}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. MECH-PROP"
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Version" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Department / Category">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select Department / Category</option>
              {(departmentsQuery.data?.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Status">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
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
