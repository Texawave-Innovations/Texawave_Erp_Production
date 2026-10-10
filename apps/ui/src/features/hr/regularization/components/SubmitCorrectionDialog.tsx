"use client";

import { useState } from "react";
import { Calendar, Info, LogIn, LogOut } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useSubmitCorrection } from "../hooks";
import {
  EMPTY_SUBMIT_FORM,
  submitCorrectionSchema,
  validateCorrectionTimes,
} from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import { ALLOWED_TIMES, CORRECTION_TYPES } from "../types";

export interface SubmitCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to request an attendance correction.";
    }
    if (error.errorCode === "CORRECTION_ALREADY_REQUESTED") {
      return "A correction has already been requested for this date.";
    }
    if (
      error.errorCode === "CORRECTION_TIME_REQUIRED" ||
      error.errorCode === "CORRECTION_FIELD_NOT_ALLOWED" ||
      error.errorCode === "PUNCH_OUTSIDE_DATE" ||
      error.errorCode === "CHECK_OUT_BEFORE_CHECK_IN" ||
      error.errorCode === "FUTURE_DATE"
    ) {
      return error.message;
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Formats an ISO YYYY-MM-DD date into a human-readable label (e.g. 'Mon, 05 Oct 2026')
 * without local timezone skew. */
function formatFriendlyDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const parts = isoDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Converts a datetime-local value (local time on attendance date) to an ISO instant.
 * TexaWave ERP Production operates in Indian Standard Time (IST, UTC+05:30).
 * Parsing with +05:30 ensures the resulting instant strictly falls on the attendance date in IST
 * regardless of the client machine's local browser timezone. */
function toIso(local: string): string {
  if (!local) return "";
  if (local.includes("Z") || local.includes("+")) {
    return new Date(local).toISOString();
  }
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}+05:30`).toISOString();
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Submits an attendance correction for the authenticated user's own
 * employee record. */
export function SubmitCorrectionDialog({
  open,
  onClose,
}: SubmitCorrectionDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_SUBMIT_FORM,
    attendanceDate: today(),
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useSubmitCorrection();
  const { toast } = useToast();

  const allowed = ALLOWED_TIMES[values.correctionType];

  function handleAttendanceDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextDate = e.target.value;
    setValues((v) => {
      const nextIn =
        v.requestedCheckInAt && nextDate
          ? `${nextDate}T${v.requestedCheckInAt.includes("T") ? v.requestedCheckInAt.split("T")[1] : "09:00"}`
          : v.requestedCheckInAt;
      const nextOut =
        v.requestedCheckOutAt && nextDate
          ? `${nextDate}T${v.requestedCheckOutAt.includes("T") ? v.requestedCheckOutAt.split("T")[1] : "18:00"}`
          : v.requestedCheckOutAt;
      return {
        ...v,
        attendanceDate: nextDate,
        requestedCheckInAt: nextIn,
        requestedCheckOutAt: nextOut,
      };
    });
    if (errors.attendanceDate) {
      setErrors((prev) => ({ ...prev, attendanceDate: undefined }));
    }
  }

  function handleCheckInChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) {
      setValues((v) => ({ ...v, requestedCheckInAt: "" }));
      return;
    }
    const time = val.includes("T") ? val.split("T")[1] : val;
    const synchronized = values.attendanceDate
      ? `${values.attendanceDate}T${time}`
      : val;
    setValues((v) => ({ ...v, requestedCheckInAt: synchronized }));
    if (errors.requestedCheckInAt) {
      setErrors((prev) => ({ ...prev, requestedCheckInAt: undefined }));
    }
  }

  function handleCheckOutChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) {
      setValues((v) => ({ ...v, requestedCheckOutAt: "" }));
      return;
    }
    const time = val.includes("T") ? val.split("T")[1] : val;
    const synchronized = values.attendanceDate
      ? `${values.attendanceDate}T${time}`
      : val;
    setValues((v) => ({ ...v, requestedCheckOutAt: synchronized }));
    if (errors.requestedCheckOutAt) {
      setErrors((prev) => ({ ...prev, requestedCheckOutAt: undefined }));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = submitCorrectionSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    const timeError = validateCorrectionTimes(result.data);
    if (timeError) {
      if (timeError.toLowerCase().includes("check-out")) {
        setErrors({ requestedCheckOutAt: timeError });
      } else {
        setErrors({ requestedCheckInAt: timeError });
      }
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({
        attendanceDate: result.data.attendanceDate,
        correctionType: result.data.correctionType,
        reason: result.data.reason,
        ...(allowed.in && result.data.requestedCheckInAt
          ? { requestedCheckInAt: toIso(result.data.requestedCheckInAt) }
          : {}),
        ...(allowed.out && result.data.requestedCheckOutAt
          ? { requestedCheckOutAt: toIso(result.data.requestedCheckOutAt) }
          : {}),
      });
      toast({ title: "Correction requested successfully", variant: "success" });
      setValues({ ...EMPTY_SUBMIT_FORM, attendanceDate: today() });
      onClose();
    } catch (error) {
      setServerError(describeSubmitError(error));
    }
  }

  const submitting = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a correction"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Info Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-brand-200/50 bg-brand-50/50 dark:border-brand-800/40 dark:bg-brand-950/30 text-theme-xs text-brand-900 dark:text-brand-200">
          <Info className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400 mt-0.5" />
          <span>
            Correction requests are reviewed by an HR administrator or reporting
            manager. Approved adjustments directly update your attendance
            record.
          </span>
        </div>

        {/* Attendance Date */}
        <FormField
          label="Attendance date"
          required
          error={errors.attendanceDate}
          hint={
            values.attendanceDate
              ? `Selected date: ${formatFriendlyDate(values.attendanceDate)} (IST)`
              : undefined
          }
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.attendanceDate}
              disabled={submitting}
              max={today()}
              onChange={handleAttendanceDateChange}
            />
          )}
        </FormField>

        {/* Correction Type */}
        <FormField
          label="Correction type"
          required
          error={errors.correctionType}
        >
          {(f) => (
            <Select
              {...f}
              value={values.correctionType}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  correctionType: e.target.value as typeof v.correctionType,
                }))
              }
            >
              {CORRECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CORRECTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Conditional Punch Fields */}
        {allowed.in || allowed.out ? (
          <div
            className={`grid gap-3 ${
              allowed.in && allowed.out
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {allowed.in ? (
              <FormField
                label="Corrected check-in"
                hint="Time on attendance date (IST)."
                error={errors.requestedCheckInAt}
              >
                {(f) => (
                  <Input
                    {...f}
                    type="datetime-local"
                    invalid={f.invalid}
                    value={values.requestedCheckInAt}
                    min={
                      values.attendanceDate
                        ? `${values.attendanceDate}T00:00`
                        : undefined
                    }
                    max={
                      values.attendanceDate
                        ? `${values.attendanceDate}T23:59`
                        : undefined
                    }
                    disabled={submitting}
                    onChange={handleCheckInChange}
                    className="font-mono text-theme-xs"
                  />
                )}
              </FormField>
            ) : null}

            {allowed.out ? (
              <FormField
                label="Corrected check-out"
                hint="Time on attendance date (IST)."
                error={errors.requestedCheckOutAt}
              >
                {(f) => (
                  <Input
                    {...f}
                    type="datetime-local"
                    invalid={f.invalid}
                    value={values.requestedCheckOutAt}
                    min={
                      values.attendanceDate
                        ? `${values.attendanceDate}T00:00`
                        : undefined
                    }
                    max={
                      values.attendanceDate
                        ? `${values.attendanceDate}T23:59`
                        : undefined
                    }
                    disabled={submitting}
                    onChange={handleCheckOutChange}
                    className="font-mono text-theme-xs"
                  />
                )}
              </FormField>
            ) : null}
          </div>
        ) : null}

        {/* Reason */}
        <FormField
          label="Reason"
          required
          error={errors.reason}
          labelAction={
            <span
              className={`font-mono text-[11px] ${
                values.reason.length > 500
                  ? "text-error-600 font-bold"
                  : "text-gray-400"
              }`}
            >
              {values.reason.length}/500
            </span>
          }
          hint="3–500 characters. Visible to whoever decides the request."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.reason}
              disabled={submitting}
              placeholder="Explain why this correction is requested..."
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Submit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
