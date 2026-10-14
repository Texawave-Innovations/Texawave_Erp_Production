"use client";

import { useState } from "react";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Video,
  MapPin,
  Globe,
  FileText,
} from "lucide-react";
import { FormSection } from "../../components/FormSection";
import {
  interviewFormSchema,
  issuesByField,
  type InterviewFormValues,
} from "../schema";
import {
  INTERVIEW_MODES,
  type CreateInterviewInput,
  type InterviewMode,
} from "../types";
import { apiErrorMessage } from "../utils";

export interface ExtendedInterviewFormValues extends InterviewFormValues {
  email?: string;
  phone?: string;
  department?: string;
  source?: string;
  endTime?: string;
  meetingLink?: string;
}

export interface InterviewFormProps {
  initialValues?: Partial<ExtendedInterviewFormValues>;
  onSubmit: (input: CreateInterviewInput) => Promise<void>;
  onCancel: () => void;
  departments?: Array<{ id: number; name: string }>;
  designations?: Array<{ id: number; name: string }>;
}

const DEFAULT_VALUES: ExtendedInterviewFormValues = {
  candidateName: "",
  email: "",
  phone: "",
  roleTitle: "",
  department: "",
  source: "Direct Application",
  interviewerName: "",
  interviewDate: "",
  interviewTime: "",
  endTime: "",
  mode: "ONLINE",
  meetingLink: "",
  notes: "",
};

/**
 * Screen 2: Schedule / Edit Interview Form conforming to TEXA Design System.
 * Features 3 numbered step sections: Candidate Information, Interview Details, and Additional Information.
 */
export function InterviewForm({
  initialValues,
  onSubmit,
  onCancel,
  departments = [],
  designations = [],
}: InterviewFormProps) {
  const [values, setValues] = useState<ExtendedInterviewFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof ExtendedInterviewFormValues>(
    key: K,
    value: ExtendedInterviewFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = interviewFormSchema.safeParse({
      candidateName: values.candidateName,
      roleTitle: values.roleTitle,
      interviewerName: values.interviewerName,
      interviewDate: values.interviewDate,
      interviewTime: values.interviewTime,
      mode: values.mode,
      notes: values.notes,
    });

    if (!result.success) {
      setErrors(issuesByField(result.error));
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      const v = result.data;

      // Pack extended metadata (email, phone, dept, meetingLink, endTime) cleanly into notes
      const extraParts: string[] = [];
      if (values.email) extraParts.push(`Email: ${values.email}`);
      if (values.phone) extraParts.push(`Phone: ${values.phone}`);
      if (values.department) extraParts.push(`Dept: ${values.department}`);
      if (values.endTime) extraParts.push(`End: ${values.endTime}`);
      if (values.meetingLink) extraParts.push(`Link: ${values.meetingLink}`);
      if (values.source) extraParts.push(`Source: ${values.source}`);

      let combinedNotes = v.notes ? v.notes.trim() : "";
      if (extraParts.length > 0) {
        combinedNotes = combinedNotes
          ? `${extraParts.join(" | ")}\n${combinedNotes}`
          : extraParts.join(" | ");
      }

      await onSubmit({
        candidateName: v.candidateName,
        roleTitle: v.roleTitle,
        interviewerName: v.interviewerName,
        interviewDate: v.interviewDate,
        interviewTime: v.interviewTime,
        mode: v.mode,
        notes: combinedNotes,
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
    <form
      onSubmit={handleSubmit}
      className="space-y-6 animate-reveal"
      noValidate
    >
      {/* Top Action Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
            Schedule Interview
          </h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Enter candidate credentials and configure interview timings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
            className="h-9 px-4 text-theme-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            className="h-9 px-4 text-theme-xs font-semibold gap-1.5"
          >
            <span>Save interview</span>
          </Button>
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50 p-3.5 text-theme-xs text-error-700 dark:border-error-900 dark:bg-error-950/50 dark:text-error-300"
        >
          {submitError}
        </div>
      )}

      {/* Step 1: Candidate Information */}
      <FormSection
        stepNumber="01"
        title="Candidate Information"
        description="Enter the candidate details and position applied for"
        icon={User}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="Candidate name"
            required
            error={errors.candidateName}
          >
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  aria-label="Candidate name"
                  value={values.candidateName}
                  onChange={(e) => set("candidateName", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Rohit Gupta"
                  className="pl-9 text-theme-xs"
                />
              </div>
            )}
          </FormField>

          <FormField label="Email" error={errors.email}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  type="email"
                  aria-label="Email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. rohit.gupta@email.com"
                  className="pl-9 text-theme-xs"
                />
              </div>
            )}
          </FormField>

          <FormField label="Phone number" error={errors.phone}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Phone className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  aria-label="Phone number"
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. +91 98765 43210"
                  className="pl-9 text-theme-xs"
                />
              </div>
            )}
          </FormField>

          <FormField label="Role / position" required error={errors.roleTitle}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Briefcase className="h-4 w-4" />
                </span>
                {designations.length > 0 ? (
                  <Select
                    {...fieldProps}
                    aria-label="Role / position"
                    value={values.roleTitle}
                    onChange={(e) => set("roleTitle", e.target.value)}
                    disabled={submitting}
                    className="pl-9 text-theme-xs"
                  >
                    <option value="">Select a role / position</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...fieldProps}
                    aria-label="Role / position"
                    value={values.roleTitle}
                    onChange={(e) => set("roleTitle", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Frontend Developer"
                    className="pl-9 text-theme-xs"
                  />
                )}
              </div>
            )}
          </FormField>

          <FormField label="Apply for / Department" error={errors.department}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Building2 className="h-4 w-4" />
                </span>
                {departments.length > 0 ? (
                  <Select
                    {...fieldProps}
                    aria-label="Apply for / Department"
                    value={values.department}
                    onChange={(e) => set("department", e.target.value)}
                    disabled={submitting}
                    className="pl-9 text-theme-xs"
                  >
                    <option value="">Select department</option>
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.name}>
                        {dep.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...fieldProps}
                    aria-label="Apply for / Department"
                    value={values.department}
                    onChange={(e) => set("department", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Software Engineering"
                    className="pl-9 text-theme-xs"
                  />
                )}
              </div>
            )}
          </FormField>

          <FormField label="Source" error={errors.source}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Globe className="h-4 w-4" />
                </span>
                <Select
                  {...fieldProps}
                  aria-label="Source"
                  value={values.source}
                  onChange={(e) => set("source", e.target.value)}
                  disabled={submitting}
                  className="pl-9 text-theme-xs"
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Employee Referral</option>
                  <option value="Job Board">Job Portal (Naukri/Indeed)</option>
                  <option value="Direct Application">Direct Application</option>
                  <option value="Campus Recruitment">Campus Recruitment</option>
                </Select>
              </div>
            )}
          </FormField>
        </div>
      </FormSection>

      {/* Step 2: Interview Details */}
      <FormSection
        stepNumber="02"
        title="Interview Details"
        description="Schedule date, timings, interviewer and interview mode"
        icon={Calendar}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <FormField
              label="Interviewer name"
              required
              error={errors.interviewerName}
              hint="Lead evaluator or HR panel member"
            >
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <User className="h-4 w-4" />
                  </span>
                  <Input
                    {...fieldProps}
                    aria-label="Interviewer name"
                    value={values.interviewerName}
                    onChange={(e) => set("interviewerName", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Arun Kumar (Tech Lead)"
                    className="pl-9 text-theme-xs"
                  />
                </div>
              )}
            </FormField>
          </div>

          <FormField
            label="Interview date"
            required
            error={errors.interviewDate}
          >
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Calendar className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  type="date"
                  aria-label="Date"
                  value={values.interviewDate}
                  onChange={(e) => set("interviewDate", e.target.value)}
                  disabled={submitting}
                  className="pl-9 text-theme-xs"
                />
              </div>
            )}
          </FormField>

          <FormField label="Start time" required error={errors.interviewTime}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Clock className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  type="time"
                  aria-label="Time"
                  value={values.interviewTime}
                  onChange={(e) => set("interviewTime", e.target.value)}
                  disabled={submitting}
                  className="pl-9 text-theme-xs"
                />
              </div>
            )}
          </FormField>
        </div>

        {/* Mode selector */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <label className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
            Interview mode <span className="text-error-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                id: "ONLINE" as InterviewMode,
                label: "Online (Video call)",
                icon: Video,
              },
              {
                id: "IN_PERSON" as InterviewMode,
                label: "On-site (Office)",
                icon: MapPin,
              },
              {
                id: "PHONE" as InterviewMode,
                label: "Phone call",
                icon: Phone,
              },
            ].map((m) => {
              const active = values.mode === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set("mode", m.id)}
                  disabled={submitting}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    active
                      ? "border-brand-500 bg-brand-50/70 text-brand-900 shadow-theme-xs dark:bg-brand-950/60 dark:text-brand-200 dark:border-brand-600 font-semibold ring-2 ring-brand-500/20"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-gray-400"
                    }`}
                  />
                  <span className="text-theme-xs">{m.label}</span>
                </button>
              );
            })}
          </div>

          <FormField
            label="Location / Meeting link"
            hint="Google Meet, Zoom URL, or Office Meeting Room Name"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={values.meetingLink}
                onChange={(e) => set("meetingLink", e.target.value)}
                disabled={submitting}
                placeholder="e.g. https://meet.google.com/abc-defg-hij or Conference Room 3B"
                className="text-theme-xs"
              />
            )}
          </FormField>
        </div>
      </FormSection>

      {/* Step 3: Additional Information */}
      <FormSection
        stepNumber="03"
        title="Additional Information"
        description="Attach evaluation instructions, resume link, or special guidelines"
        icon={FileText}
      >
        <FormField
          label="Notes / instructions"
          error={errors.notes}
          hint="Topics to evaluate, assessment links, or special instructions"
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              rows={4}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={submitting}
              placeholder="e.g. Candidate submitted portfolio at github.com/rohit; evaluate system design and database normalization."
              className="text-theme-xs"
            />
          )}
        </FormField>
      </FormSection>
    </form>
  );
}
