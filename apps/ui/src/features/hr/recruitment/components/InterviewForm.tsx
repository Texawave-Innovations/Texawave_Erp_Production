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
  Check,
} from "lucide-react";
import { FormSection } from "../../components/FormSection";
import {
  interviewFormSchema,
  type InterviewFormValues,
} from "../schema";
import {
  type CreateInterviewInput,
  type InterviewMode,
} from "../types";
import { apiErrorMessage } from "../utils";

export interface ExtendedInterviewFormValues extends InterviewFormValues {
  email?: string;
  phone?: string;
  department?: string;
  source?: string;
  duration?: string;
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
  duration: "45 mins",
  endTime: "",
  mode: "ONLINE",
  meetingLink: "",
  notes: "",
};

const DURATION_OPTIONS = ["30 mins", "45 mins", "1 hour", "1.5 hours"];

/**
 * Enhanced Schedule / Edit Interview Form conforming to TexaOne Design System.
 * Centered, balanced 2-column layout with visual stepper, duration chips, and contextual mode fields.
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
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
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
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const v = result.data;

      // Pack extended metadata cleanly into notes
      const extraParts: string[] = [];
      if (values.email) extraParts.push(`Email: ${values.email}`);
      if (values.phone) extraParts.push(`Phone: ${values.phone}`);
      if (values.department) extraParts.push(`Dept: ${values.department}`);
      if (values.duration) extraParts.push(`Duration: ${values.duration}`);
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
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Top Visual Stepper Breadcrumbs */}
      <div className="hidden sm:grid grid-cols-3 gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold shadow-xs">
            1
          </div>
          <div className="flex flex-col">
            <span className="text-theme-xs font-bold text-gray-900 dark:text-white">
              Candidate Info
            </span>
            <span className="text-[11px] text-gray-500">
              Profile & position applied
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold dark:bg-brand-950/60 dark:text-cyan-400">
            2
          </div>
          <div className="flex flex-col">
            <span className="text-theme-xs font-bold text-gray-900 dark:text-white">
              Interview Slot & Mode
            </span>
            <span className="text-[11px] text-gray-500">
              Date, time & platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-bold dark:bg-gray-800 dark:text-gray-400">
            3
          </div>
          <div className="flex flex-col">
            <span className="text-theme-xs font-bold text-gray-900 dark:text-white">
              Instructions
            </span>
            <span className="text-[11px] text-gray-500">
              Evaluation notes
            </span>
          </div>
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

      {/* ================= STEP 1: CANDIDATE INFORMATION ================= */}
      <FormSection
        stepNumber="1"
        title="Candidate Information"
        description="Enter the candidate details and position applied for."
        icon={User}
      >
        <div className="space-y-4">
          {/* Row 1: Candidate Name (Full Width) */}
          <FormField
            label="Candidate Name"
            required
            error={errors.candidateName}
          >
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  aria-label="Candidate Name"
                  value={values.candidateName}
                  onChange={(e) => set("candidateName", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Rohit Gupta"
                  className="pl-10 text-theme-sm rounded-xl font-medium"
                />
              </div>
            )}
          </FormField>

          {/* Row 2: Email & Phone Number (2 Equal Columns) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Email Address" error={errors.email}>
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <Input
                    {...fieldProps}
                    type="email"
                    aria-label="Email Address"
                    value={values.email}
                    onChange={(e) => set("email", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. rohit.gupta@email.com"
                    className="pl-10 text-theme-sm rounded-xl"
                  />
                </div>
              )}
            </FormField>

            <FormField label="Phone Number" error={errors.phone}>
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Phone className="h-4 w-4" />
                  </span>
                  <Input
                    {...fieldProps}
                    aria-label="Phone Number"
                    value={values.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. +91 98765 43210"
                    className="pl-10 text-theme-sm rounded-xl"
                  />
                </div>
              )}
            </FormField>
          </div>

          {/* Row 3: Role / Position & Department (2 Equal Columns) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Role / Position" required error={errors.roleTitle}>
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  {designations.length > 0 ? (
                    <Select
                      {...fieldProps}
                      aria-label="Role / Position"
                      value={values.roleTitle}
                      onChange={(e) => set("roleTitle", e.target.value)}
                      disabled={submitting}
                      className="pl-10 text-theme-sm rounded-xl"
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
                      aria-label="Role / Position"
                      value={values.roleTitle}
                      onChange={(e) => set("roleTitle", e.target.value)}
                      disabled={submitting}
                      placeholder="e.g. Frontend Developer"
                      className="pl-10 text-theme-sm rounded-xl"
                    />
                  )}
                </div>
              )}
            </FormField>

            <FormField label="Department" error={errors.department}>
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Building2 className="h-4 w-4" />
                  </span>
                  {departments.length > 0 ? (
                    <Select
                      {...fieldProps}
                      aria-label="Department"
                      value={values.department}
                      onChange={(e) => set("department", e.target.value)}
                      disabled={submitting}
                      className="pl-10 text-theme-sm rounded-xl"
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
                      aria-label="Department"
                      value={values.department}
                      onChange={(e) => set("department", e.target.value)}
                      disabled={submitting}
                      placeholder="e.g. Software Engineering"
                      className="pl-10 text-theme-sm rounded-xl"
                    />
                  )}
                </div>
              )}
            </FormField>
          </div>

          {/* Row 4: Application Source (Full Width) */}
          <FormField label="Candidate Source" error={errors.source}>
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Globe className="h-4 w-4" />
                </span>
                <Select
                  {...fieldProps}
                  aria-label="Candidate Source"
                  value={values.source}
                  onChange={(e) => set("source", e.target.value)}
                  disabled={submitting}
                  className="pl-10 text-theme-sm rounded-xl"
                >
                  <option value="Direct Application">Direct Application</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Employee Referral</option>
                  <option value="Job Board">Job Portal (Naukri/Indeed)</option>
                  <option value="Campus Recruitment">Campus Recruitment</option>
                </Select>
              </div>
            )}
          </FormField>
        </div>
      </FormSection>

      {/* ================= STEP 2: INTERVIEW DETAILS ================= */}
      <FormSection
        stepNumber="2"
        title="Interview Details"
        description="Schedule date, timings, interviewer and interview mode."
        icon={Calendar}
      >
        <div className="space-y-4">
          {/* Row 1: Interviewer Name */}
          <FormField
            label="Interviewer Name"
            required
            error={errors.interviewerName}
            hint="Lead evaluator, Technical Lead, or HR panel member"
          >
            {(fieldProps) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  {...fieldProps}
                  aria-label="Interviewer Name"
                  value={values.interviewerName}
                  onChange={(e) => set("interviewerName", e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Arun Kumar (Tech Lead)"
                  className="pl-10 text-theme-sm rounded-xl font-medium"
                />
              </div>
            )}
          </FormField>

          {/* Row 2: Date & Start Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Interview Date"
              required
              error={errors.interviewDate}
            >
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <Input
                    {...fieldProps}
                    type="date"
                    aria-label="Interview Date"
                    value={values.interviewDate}
                    onChange={(e) => set("interviewDate", e.target.value)}
                    disabled={submitting}
                    className="pl-10 text-theme-sm rounded-xl"
                  />
                </div>
              )}
            </FormField>

            <FormField
              label="Start Time"
              required
              error={errors.interviewTime}
            >
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <Clock className="h-4 w-4" />
                  </span>
                  <Input
                    {...fieldProps}
                    type="time"
                    aria-label="Start Time"
                    value={values.interviewTime}
                    onChange={(e) => set("interviewTime", e.target.value)}
                    disabled={submitting}
                    className="pl-10 text-theme-sm rounded-xl"
                  />
                </div>
              )}
            </FormField>
          </div>

          {/* Quick Duration Chips */}
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Estimated Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((dur) => {
                const active = values.duration === dur;
                return (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => set("duration", dur)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "bg-brand-600 text-white shadow-xs"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {dur}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interview Mode Selector */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
              Interview Mode <span className="text-error-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  id: "ONLINE" as InterviewMode,
                  label: "Online (Video Call)",
                  hint: "Google Meet / Zoom",
                  icon: Video,
                },
                {
                  id: "IN_PERSON" as InterviewMode,
                  label: "On-site (Office)",
                  hint: "Meeting Room / HQ",
                  icon: MapPin,
                },
                {
                  id: "PHONE" as InterviewMode,
                  label: "Phone Call",
                  hint: "Telephonic Screen",
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
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-brand-500 bg-brand-50/70 text-brand-900 shadow-theme-xs dark:bg-brand-950/60 dark:text-cyan-300 dark:border-brand-600 font-semibold ring-2 ring-brand-500/20"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 mt-0.5 ${
                        active
                          ? "text-brand-600 dark:text-cyan-400"
                          : "text-gray-400"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="text-theme-xs font-bold leading-tight">
                        {m.label}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.hint}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Mode-Specific Field */}
            <FormField
              label={
                values.mode === "ONLINE"
                  ? "Meeting Link (Google Meet / Zoom / Teams)"
                  : values.mode === "IN_PERSON"
                    ? "Office Room / Conference Room Name"
                    : "Primary Phone Number for Call"
              }
              hint={
                values.mode === "ONLINE"
                  ? "Paste video meeting link for candidate & evaluator"
                  : values.mode === "IN_PERSON"
                    ? "Specific floor, hall, or room inside the office"
                    : "Number the interviewer will dial at scheduled time"
              }
            >
              {(fieldProps) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    {values.mode === "ONLINE" ? (
                      <Video className="h-4 w-4" />
                    ) : values.mode === "IN_PERSON" ? (
                      <MapPin className="h-4 w-4" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                  </span>
                  <Input
                    {...fieldProps}
                    value={values.meetingLink}
                    onChange={(e) => set("meetingLink", e.target.value)}
                    disabled={submitting}
                    placeholder={
                      values.mode === "ONLINE"
                        ? "e.g. https://meet.google.com/abc-defg-hij"
                        : values.mode === "IN_PERSON"
                          ? "e.g. Conference Room 3B, 2nd Floor, Main Office"
                          : "e.g. +91 98765 43210"
                    }
                    className="pl-10 text-theme-sm rounded-xl"
                  />
                </div>
              )}
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* ================= STEP 3: ADDITIONAL INFORMATION ================= */}
      <FormSection
        stepNumber="3"
        title="Additional Information"
        description="Attach evaluation instructions, focus areas, or special guidelines."
        icon={FileText}
      >
        <FormField
          label="Notes / Instructions"
          error={errors.notes}
          hint="Topics to evaluate, assessment links, coding challenge URL, or special notes"
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              rows={3}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={submitting}
              placeholder="e.g. Candidate submitted portfolio; evaluate React architectural patterns, SQL normalization, and problem-solving approach."
              className="text-theme-sm rounded-xl"
            />
          )}
        </FormField>
      </FormSection>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
          className="h-10 px-5 text-theme-sm font-semibold rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          className="h-10 px-6 text-theme-sm font-semibold rounded-xl gap-2 shadow-xs"
        >
          <Check className="h-4 w-4" />
          <span>Save & Schedule Interview</span>
        </Button>
      </div>
    </form>
  );
}
