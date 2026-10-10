"use client";

import { useMemo, useState } from "react";
import { Calendar, Plus, Trash2, User } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useManualEditAttendance } from "../hooks";
import { manualEditSchema, type EditableSession } from "../schema";
import { formatMinutes, STATUS_LABELS } from "../status";
import { STORED_STATUSES, type AttendanceDayView } from "../types";

export interface ManualEditAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceDayView;
  employee?: {
    fullName: string;
    employeeCode: string;
  } | null;
}

function describeEditError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to edit attendance records.";
    }
    if (error.statusCode === 404) {
      return "This record is no longer in your scope.";
    }
    if (error.errorCode === "PUNCH_OUTSIDE_DATE") {
      return "Every punch must fall on the attendance date.";
    }
    if (error.errorCode === "SESSIONS_INCONSISTENT") {
      return "Sessions must be ordered and non-overlapping, and a closed session must end after it starts.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Converts a datetime-local value (local time, no zone) to an ISO instant.
 * Sessions are validated against the record's attendance date server-side. */
function toIso(local: string): string {
  if (!local) return "";
  if (local.includes("Z") || local.includes("+")) {
    return new Date(local).toISOString();
  }
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}+05:30`).toISOString();
}

function fromIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function getDurationBadge(
  checkInAt: string,
  checkOutAt: string,
): string | null {
  if (!checkInAt || !checkOutAt) return null;
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const minutes = Math.floor((end - start) / 60000);
  return formatMinutes(minutes);
}

/** HR manual edit of a day's status and punches (audited). `.own` is refused
 * server-side — nobody may edit their own record. */
export function ManualEditAttendanceDialog({
  open,
  onClose,
  record,
  employee,
}: ManualEditAttendanceDialogProps) {
  const [status, setStatus] = useState<string>(record.storedStatus ?? "");
  const [sessions, setSessions] = useState<EditableSession[]>(
    record.sessions.map((s) => ({
      checkInAt: fromIso(s.checkInAt),
      checkOutAt: fromIso(s.checkOutAt),
    })),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useManualEditAttendance();
  const submitting = mutation.isPending;

  function updateSession(
    index: number,
    key: keyof EditableSession,
    value: string,
  ) {
    setSessions((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }

  function addSession() {
    setSessions((rows) => [
      ...rows,
      {
        checkInAt: `${record.attendanceDate}T09:00`,
        checkOutAt: `${record.attendanceDate}T18:00`,
      },
    ]);
  }

  function removeSession(index: number) {
    setSessions((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = manualEditSchema.safeParse({ status, sessions });
    if (!result.success) {
      setErrors({ sessions: result.error.issues[0]?.message ?? "Invalid" });
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: record.recordId as number,
        body: {
          status:
            status === ""
              ? null
              : (status as "PRESENT" | "ABSENT" | "HALF_DAY"),
          sessions: result.data.sessions.map((s) => ({
            checkInAt: toIso(s.checkInAt),
            checkOutAt: s.checkOutAt ? toIso(s.checkOutAt) : null,
          })),
        },
      });
      onClose();
    } catch (error) {
      setServerError(describeEditError(error));
    }
  }

  const dateMin = `${record.attendanceDate}T00:00`;
  const dateMax = `${record.attendanceDate}T23:59`;

  return (
    <Dialog open={open} onClose={onClose} title="Edit attendance" size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Record Context Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
            <User className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {employee?.fullName ?? `Employee #${record.employeeId}`}
            </span>
            <span className="text-gray-400">
              ({employee?.employeeCode ?? `#${record.employeeId}`})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span>
              Date:{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                {record.attendanceDate}
              </strong>
            </span>
          </div>
        </div>

        {/* Status Selection */}
        <FormField
          label="Attendance status"
          hint="Select an explicit status, or leave as 'Not set' to automatically derive status from punches."
        >
          {(f) => (
            <Select
              {...f}
              value={status}
              disabled={submitting}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Not set (Auto-derive from punches)</option>
              {STORED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Sessions Editor */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                Punch Sessions ({sessions.length})
              </span>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Punches must fall on {record.attendanceDate} and not overlap.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addSession}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-theme-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Add session
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/40 dark:bg-gray-800/20">
              <p className="text-theme-sm text-gray-500 dark:text-gray-400 mb-2">
                No punches recorded for this day.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addSession}
                disabled={submitting}
                className="text-theme-xs font-semibold text-brand-600 dark:text-brand-400"
              >
                + Add a session
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Desktop Column Header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_100px_40px] gap-2.5 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <span>Check-in</span>
                <span>Check-out</span>
                <span>Duration</span>
                <span className="sr-only">Actions</span>
              </div>

              {sessions.map((s, i) => {
                const duration = getDurationBadge(
                  s.checkInAt,
                  s.checkOutAt ?? "",
                );
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_100px_40px] gap-2.5 p-3 sm:p-2 rounded-xl bg-gray-50/70 sm:bg-transparent dark:bg-gray-800/40 sm:dark:bg-transparent items-center border sm:border-0 border-gray-100 dark:border-gray-800"
                  >
                    <div className="w-full">
                      <span className="block sm:hidden text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                        Check-in
                      </span>
                      <Input
                        type="datetime-local"
                        aria-label="Check-in"
                        value={s.checkInAt}
                        min={dateMin}
                        max={dateMax}
                        disabled={submitting}
                        onChange={(e) =>
                          updateSession(i, "checkInAt", e.target.value)
                        }
                        className="w-full text-theme-xs font-mono"
                      />
                    </div>

                    <div className="w-full">
                      <span className="block sm:hidden text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                        Check-out
                      </span>
                      <Input
                        type="datetime-local"
                        aria-label="Check-out"
                        value={s.checkOutAt}
                        min={dateMin}
                        max={dateMax}
                        disabled={submitting}
                        onChange={(e) =>
                          updateSession(i, "checkOutAt", e.target.value)
                        }
                        className="w-full text-theme-xs font-mono"
                      />
                    </div>

                    <div className="w-full flex items-center">
                      <span className="inline-block sm:hidden text-[11px] font-bold text-gray-500 dark:text-gray-400 mr-2">
                        Duration:
                      </span>
                      {duration ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-theme-xs font-semibold">
                          {duration}
                        </span>
                      ) : (
                        <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                          {s.checkInAt && !s.checkOutAt ? "Open" : "—"}
                        </span>
                      )}
                    </div>

                    <div className="w-full flex justify-end sm:justify-center">
                      <button
                        type="button"
                        title="Remove session"
                        aria-label="Remove session"
                        disabled={submitting}
                        onClick={() => removeSession(i)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 dark:hover:text-error-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errors.sessions ? (
            <p className="text-theme-xs text-error-600 dark:text-error-400 font-medium">
              {errors.sessions}
            </p>
          ) : null}
        </div>

        {serverError ? (
          <Alert variant="error" title="Could not save">
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
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
