"use client";

import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  interviewFormSchema,
  issuesByField,
  type InterviewFormValues,
} from "../schema";
import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_MODES,
  type CreateInterviewInput,
  type InterviewMode,
} from "../types";
import { apiErrorMessage } from "../utils";

export interface InterviewFormProps {
  onSubmit: (input: CreateInterviewInput) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: InterviewFormValues = {
  candidateName: "",
  roleTitle: "",
  interviewerName: "",
  interviewDate: "",
  interviewTime: "",
  mode: "ONLINE",
  notes: "",
};

/** Schedule-interview form. Field names and limits follow
 * CreateInterviewDto; the backend re-validates on submit. */
export function InterviewForm({ onSubmit, onCancel }: InterviewFormProps) {
  const [values, setValues] = useState<InterviewFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof InterviewFormValues>(
    key: K,
    value: InterviewFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = interviewFormSchema.safeParse(values);
    if (!result.success) {
      setErrors(issuesByField(result.error));
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const v = result.data;
      await onSubmit({
        candidateName: v.candidateName,
        roleTitle: v.roleTitle,
        interviewerName: v.interviewerName,
        interviewDate: v.interviewDate,
        interviewTime: v.interviewTime,
        mode: v.mode,
        notes: v.notes,
      });
    } catch (error) {
      setSubmitError(
        apiErrorMessage(error, "Could not schedule the interview. Try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="Candidate name" required error={errors.candidateName}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={values.candidateName}
            onChange={(e) => set("candidateName", e.target.value)}
            disabled={submitting}
            placeholder="e.g. Ramesh Kumar"
          />
        )}
      </FormField>

      <FormField label="Role / position" required error={errors.roleTitle}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={values.roleTitle}
            onChange={(e) => set("roleTitle", e.target.value)}
            disabled={submitting}
            placeholder="e.g. Full Stack Developer"
          />
        )}
      </FormField>

      <FormField
        label="Interviewer name"
        required
        error={errors.interviewerName}
        hint="Free text, for example Tech Lead or HR"
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={values.interviewerName}
            onChange={(e) => set("interviewerName", e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date" required error={errors.interviewDate}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={values.interviewDate}
              onChange={(e) => set("interviewDate", e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Time" required error={errors.interviewTime}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="time"
              value={values.interviewTime}
              onChange={(e) => set("interviewTime", e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <FormField label="Interview mode" error={errors.mode}>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={values.mode}
            onChange={(e) => set("mode", e.target.value as InterviewMode)}
            disabled={submitting}
          >
            {INTERVIEW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {INTERVIEW_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        label="Notes / instructions"
        error={errors.notes}
        hint="Resume links, topics to evaluate, or interview notes"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={3}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

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
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save interview
        </Button>
      </div>
    </form>
  );
}
