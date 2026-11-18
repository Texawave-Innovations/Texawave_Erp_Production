"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
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
  const { toast } = useToast();
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
      toast({ title: "Auto check-out saved", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? "You don't have permission to change attendance settings."
            : error instanceof ApiError
              ? error.message
              : "Could not save the auto check-out setting",
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
        <Checkbox
          checked={enabled}
          disabled={!canWrite}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5"
        />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Automatically check out everyone at a fixed time
          </span>
          <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Anyone still checked in at the cut-off is checked out at that time,
            on the day they checked in. Those days stay pending until HR
            regularizes them. When off, a session closes after the employee's
            shift hours instead.
          </span>
        </div>
      </div>

      <FormField
        label="Cut-off time (IST)"
        hint="24-hour time, e.g. 20:00. Never later than midnight of the same day."
        {...(!timeValid ? { error: "Enter a time as HH:mm, e.g. 20:00" } : {})}
      >
        {(fp) => (
          <Input
            {...fp}
            type="time"
            value={time}
            disabled={!canWrite || !enabled}
            onChange={(e) => setTime(e.target.value)}
            className="max-w-[10rem]"
          />
        )}
      </FormField>

      {canWrite ? (
        <div>
          <Button
            onClick={() => void handleSave()}
            disabled={!dirty || !timeValid || update.isPending}
            className="rounded-xl px-4 py-2 font-bold"
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** HR Master → Attendance: the organization's automatic check-out. */
export function AutoCheckoutCard() {
  const canRead = usePermission(SETTINGS_READ);
  const canWrite = usePermission(SETTINGS_WRITE);
  const query = useAttendanceSettings(canRead);

  return (
    <section
      aria-label="Auto check-out"
      className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 sm:col-span-2 lg:col-span-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
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
  );
}
