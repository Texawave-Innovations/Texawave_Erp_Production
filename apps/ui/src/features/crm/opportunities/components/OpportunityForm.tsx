"use client";

import {
  OPPORTUNITY_PRIORITIES,
  createOpportunitySchema,
  type CreateOpportunityFormValues,
} from "@texawave-erp/core";
import { Button, FormField, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { AccountCombobox } from "../../accounts/components/AccountCombobox";
import { usePipelineStages } from "../../pipeline-stages/hooks";

export interface OpportunityFormProps {
  initialValues?: Partial<CreateOpportunityFormValues>;
  onSubmit: (values: CreateOpportunityFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  /** Stage is only editable on create — a stage move always goes through
   * the dedicated Move/Won/Lost/On-Hold/Reopen actions, never a silent
   * side effect of this form (matches UpdateOpportunityDto excluding
   * stageId). */
  lockStage?: boolean;
}

/** Reproduces the legacy Pipeline.tsx "+New Deal" dialog's four required
 * fields (Account, Title, Owner, Estimated Value) plus the optional
 * fields it also carries (currency defaulted server-side, expected close
 * date, priority, campaign source, contact role). */
export function OpportunityForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
  lockStage,
}: OpportunityFormProps) {
  const [accountId, setAccountId] = useState<number | undefined>(
    initialValues?.accountId,
  );
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [ownerName, setOwnerName] = useState(initialValues?.ownerName ?? "");
  const [stageId, setStageId] = useState<number | undefined>(
    initialValues?.stageId,
  );
  const [estimatedValue, setEstimatedValue] = useState(
    initialValues?.estimatedValue !== undefined
      ? String(initialValues.estimatedValue)
      : "",
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    initialValues?.expectedCloseDate ?? "",
  );
  const [priority, setPriority] = useState(initialValues?.priority ?? "");
  const [campaignSource, setCampaignSource] = useState(
    initialValues?.campaignSource ?? "",
  );
  const [contactRole, setContactRole] = useState(
    initialValues?.contactRole ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stagesQuery = usePipelineStages();
  const boardStages = (stagesQuery.data ?? [])
    .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createOpportunitySchema.safeParse({
      accountId,
      title,
      ownerName,
      stageId,
      estimatedValue:
        estimatedValue === "" ? undefined : Number(estimatedValue),
      expectedCloseDate: expectedCloseDate || undefined,
      priority: priority || undefined,
      campaignSource: campaignSource || undefined,
      contactRole: contactRole || undefined,
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
        "Could not save this deal. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AccountCombobox
        value={accountId}
        onChange={setAccountId}
        disabled={submitting}
        error={errors.accountId}
      />
      <FormField label="Deal Title" required error={errors.title}>
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
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Owner" required error={errors.ownerName}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField
          label="Estimated Value"
          required
          error={errors.estimatedValue}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              invalid={fieldProps.invalid}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
      {!lockStage && (
        <FormField label="Stage" required error={errors.stageId}>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={stageId ?? ""}
              onChange={(e) =>
                setStageId(e.target.value ? Number(e.target.value) : undefined)
              }
              disabled={submitting || stagesQuery.isPending}
            >
              <option value="" disabled>
                Select a stage
              </option>
              {boardStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Expected Close Date" error={errors.expectedCloseDate}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              invalid={fieldProps.invalid}
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Priority" error={errors.priority}>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={submitting}
            >
              <option value="">—</option>
              {OPPORTUNITY_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Campaign Source" error={errors.campaignSource}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={campaignSource}
              onChange={(e) => setCampaignSource(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Contact Role" error={errors.contactRole}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>
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
