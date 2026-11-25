"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import { Button, Card, Checkbox, Input } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import {
  useAttendanceSettings,
  useUpdateAttendanceSettings,
} from "@/features/hr/attendance/hooks";
import {
  SETTINGS_READ,
  SETTINGS_WRITE,
} from "@/features/hr/attendance/permissions";
import type { AttendanceSettings } from "@/features/hr/attendance/types";

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The form is keyed on the saved version, so it re-seeds after every save. */
function AutoCheckoutForm({
  settings,
  canWrite,
}: {
  settings: AttendanceSettings;
  canWrite: boolean;
}) {
  const { notify, notifyError } = useNotify();
  const update = useUpdateAttendanceSettings();
  const [enabled, setEnabled] = useState(settings.autoCheckoutEnabled);
  const [time, setTime] = useState(settings.autoCheckoutTime);

  const timeValid = TIME_PATTERN.test(time);
  const dirty =
    enabled !== settings.autoCheckoutEnabled ||
    time !== settings.autoCheckoutTime;

  async function handleSave() {
    try {
      await update.mutateAsync({
        version: settings.version,
        autoCheckoutEnabled: enabled,
        autoCheckoutTime: time,
      });
      notify("hr.master.autoCheckoutSaved");
    } catch (error) {
      if (error instanceof ApiError && error.isPermissionError) {
        notify("hr.master.attendanceSettingsDenied");
      } else {
        notifyError(error, "hr.master.autoCheckoutFailed");
      }
    }
  }

  // Compact, like the other HR Master cards: one toggle line, then the time
  // and Save on one row (same shape as their "Add value" + "Add" row).
  return (
    <div className="flex flex-col gap-3">
      <label
        className="flex cursor-pointer items-center gap-2 text-theme-xs text-gray-700 dark:text-gray-300"
        title="When off, a forgotten check-out is closed at the end of the day (23:59 IST). Either way the close time is not a check-out: the session counts no hours until HR regularizes it."
      >
        <Checkbox
          checked={enabled}
          disabled={!canWrite}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Check out everyone at an earlier fixed time (IST)
      </label>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {enabled
          ? "Forgotten check-outs close at this time and stay pending until HR regularizes them."
          : "Off: forgotten check-outs close at 23:59 IST and stay pending until HR regularizes them."}
      </p>

      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Input
          type="time"
          aria-label="Cut-off time (IST)"
          value={time}
          invalid={!timeValid}
          disabled={!canWrite || !enabled}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1"
        />
        {canWrite ? (
          <Button
            onClick={() => void handleSave()}
            disabled={!dirty || !timeValid || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {!timeValid ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          Enter a time as HH:mm, e.g. 20:00
        </p>
      ) : null}
    </div>
  );
}

/** HR Master → Attendance: the organization's automatic check-out. */
export function AutoCheckoutCard() {
  const canRead = usePermission(SETTINGS_READ);
  const canWrite = usePermission(SETTINGS_WRITE);
  const query = useAttendanceSettings(canRead);

  // Same shell as the other HR Master cards (ui-kit MasterListCard: Card p-4,
  // text-theme-sm heading), as one regular grid cell — it sits beside Shifts.
  return (
    <Card className="p-4">
      <section aria-label="Auto check-out" className="flex flex-col gap-3">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Auto Check-out
        </h3>
        {!canRead ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You need the {SETTINGS_READ} permission to view this setting.
          </p>
        ) : query.isPending ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading…</p>
        ) : query.isError || !query.data ? (
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span>Could not load the auto check-out setting.</span>
            <Button variant="glass" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <AutoCheckoutForm
            key={query.data.version}
            settings={query.data}
            canWrite={canWrite}
          />
        )}
      </section>
    </Card>
  );
}
