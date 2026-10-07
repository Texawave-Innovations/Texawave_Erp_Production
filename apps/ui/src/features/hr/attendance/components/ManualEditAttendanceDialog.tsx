"use client";

import { useState } from "react";
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
import { STATUS_LABELS } from "../status";
import { STORED_STATUSES, type AttendanceDayView } from "../types";

export interface ManualEditAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceDayView;
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
  return new Date(local).toISOString();
}

function fromIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** HR manual edit of a day's status and punches (audited). `.own` is refused
 * server-side — nobody may edit their own record. */
export function ManualEditAttendanceDialog({
  open,
  onClose,
  record,
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
    setSessions((rows) => [...rows, { checkInAt: "", checkOutAt: "" }]);
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

  return (
    <Dialog open={open} onClose={onClose} title="Edit attendance">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Status" hint="Leave blank to derive the day again.">
          {(f) => (
            <Select
              {...f}
              value={status}
              disabled={submitting}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Not set</option>
              {STORED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Sessions
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addSession}
              disabled={submitting}
            >
              Add session
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No punches. Add a session or leave empty to clear them.
            </p>
          ) : (
            sessions.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  type="datetime-local"
                  aria-label="Check-in"
                  value={s.checkInAt}
                  disabled={submitting}
                  onChange={(e) =>
                    updateSession(i, "checkInAt", e.target.value)
                  }
                />
                <Input
                  type="datetime-local"
                  aria-label="Check-out"
                  value={s.checkOutAt}
                  disabled={submitting}
                  onChange={(e) =>
                    updateSession(i, "checkOutAt", e.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onClick={() => removeSession(i)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          {errors.sessions ? (
            <p className="text-theme-xs text-error-600 dark:text-error-400">
              {errors.sessions}
            </p>
          ) : null}
        </div>

        {serverError ? (
          <Alert variant="error" title="Could not save">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
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
