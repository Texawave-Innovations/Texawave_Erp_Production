"use client";

import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveErrorText } from "@texawave-erp/core";
import { Button, Card, EmptyState, TableSkeleton } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";
import {
  useMyWorkPermissions,
  useCreateMyWorkPermission,
} from "@/features/employee-self-service/work-permissions/hooks";
import type { WorkPermission } from "@/features/employee-self-service/work-permissions/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMins(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:border-success-800/40 dark:bg-success-900/20 dark:text-success-400">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2 py-0.5 text-[11px] font-semibold text-error-700 dark:border-error-800/40 dark:bg-error-900/20 dark:text-error-400">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:border-warning-800/40 dark:bg-warning-900/20 dark:text-warning-400">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

// ── Custom themed dropdown ────────────────────────────────────────────────────

function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-48 overflow-y-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/20 dark:hover:text-brand-300 ${
                  opt.value === value
                    ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom date picker ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DatePicker({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date(min);
  const selected = value ? new Date(value + "T00:00:00") : null;

  const [view, setView] = useState(() => {
    const d = selected ?? today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function prevMonth() {
    setView((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function nextMonth() {
    setView((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // Build grid: leading blanks + days in month
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    const mm = String(view.month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${view.year}-${mm}-${dd}`);
    setOpen(false);
  }

  function isDisabled(day: number) {
    const cell = new Date(view.year, view.month, day);
    return cell < today;
  }

  function isSelected(day: number) {
    if (!selected) return false;
    return (
      selected.getFullYear() === view.year &&
      selected.getMonth() === view.month &&
      selected.getDate() === day
    );
  }

  const displayValue = selected
    ? selected.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Select date";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <span className={selected ? "" : "text-gray-400 dark:text-gray-500"}>
          {displayValue}
        </span>
        <Calendar className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {MONTH_NAMES[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-name row */}
          <div className="grid grid-cols-7 border-b border-gray-100 px-2 py-1 dark:border-gray-700">
            {DAY_NAMES.map((d) => (
              <span
                key={d}
                className="text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 gap-y-0.5 p-2">
            {cells.map((day, idx) =>
              day === null ? (
                <span key={`blank-${idx}`} />
              ) : isSelected(day) ? (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white"
                >
                  {day}
                </button>
              ) : isDisabled(day) ? (
                <span
                  key={day}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-300 dark:text-gray-600"
                >
                  {day}
                </span>
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-brand-900/20 dark:hover:text-brand-300"
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time select (hour + minute custom dropdowns) ──────────────────────────────

const HOUR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const hr = i + 10;
  const label = hr < 12 ? `${hr} AM` : hr === 12 ? "12 PM" : `${hr - 12} PM`;
  return { value: String(hr).padStart(2, "0"), label };
});

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const val = String(i).padStart(2, "0");
  return { value: val, label: `${val} min` };
});

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // `value` is always HH:mm; the fallbacks only satisfy the type checker.
  const [h = "", m = ""] = value.split(":");
  return (
    <div>
      <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Dropdown
          value={h}
          options={HOUR_OPTIONS}
          onChange={(v) => onChange(`${v}:${m}`)}
        />
        <Dropdown
          value={m}
          options={MINUTE_OPTIONS}
          onChange={(v) => onChange(`${h}:${v}`)}
        />
      </div>
    </div>
  );
}

// ── Request dialog ────────────────────────────────────────────────────────────

function RequestDialog({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [fromTime, setFromTime] = useState("10:00");
  const [toTime, setToTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useNotify();
  const mutation = useCreateMyWorkPermission();

  const durationMins = (() => {
    const [fh = 0, fm = 0] = fromTime.split(":").map(Number);
    const [th = 0, tm = 0] = toTime.split(":").map(Number);
    const diff = th * 60 + tm - (fh * 60 + fm);
    return diff > 0 ? diff : 0;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (durationMins <= 0) {
      setFormError("End time must be after start time.");
      return;
    }
    if (durationMins > 120) {
      setFormError("Permission cannot exceed 2 hours (120 minutes).");
      return;
    }
    try {
      await mutation.mutateAsync({
        date,
        fromTime,
        toTime,
        reason: reason.trim(),
      });
      notify("selfService.permission.submitted");
      onClose();
    } catch (err) {
      setFormError(
        resolveErrorText(err, "selfService.permission.submitFailed"),
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
              Request Permission
            </h3>
            <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              Work hours: 10:00 AM – 7:00 PM · Maximum 2 hours per request
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* date */}
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Date
            </label>
            <DatePicker value={date} min={today} onChange={setDate} />
          </div>

          {/* times */}
          <div className="grid grid-cols-2 gap-4">
            <TimeSelect label="From" value={fromTime} onChange={setFromTime} />
            <TimeSelect label="To" value={toTime} onChange={setToTime} />
          </div>

          {/* duration hint */}
          {durationMins > 0 && (
            <p
              className={`text-theme-xs font-medium ${durationMins > 120 ? "text-error-600 dark:text-error-400" : "text-brand-600 dark:text-brand-400"}`}
            >
              Duration: {formatMins(durationMins)}
              {durationMins > 120 ? " — exceeds the 2-hour limit" : ""}
            </p>
          )}

          {/* reason */}
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              required
              placeholder="e.g. Doctor appointment, personal errand…"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          {/* error */}
          {formError && (
            <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-xs text-error-700 dark:border-error-800/40 dark:bg-error-900/20 dark:text-error-400">
              {formError}
            </p>
          )}

          {/* actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────

function HistoryTable({ items }: { items: WorkPermission[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-200 dark:border-brand-800/40">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-brand-100 bg-brand-50/60 dark:border-brand-800/30 dark:bg-brand-900/10">
            {["Date", "Time", "Duration", "Reason", "Status"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 first:pl-5 last:pr-5 text-theme-xs font-semibold text-brand-700 dark:text-brand-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100 dark:divide-brand-800/30">
          {items.map((item) => (
            <tr
              key={item.id}
              className="hover:bg-brand-50/40 dark:hover:bg-brand-900/10 transition-colors"
            >
              <td className="px-4 py-3 pl-5 text-theme-sm font-medium text-gray-900 dark:text-white/90 whitespace-nowrap">
                {formatDate(item.date)}
              </td>
              <td className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {item.fromTime} – {item.toTime}
              </td>
              <td className="px-4 py-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {formatMins(item.durationMins)}
              </td>
              <td className="px-4 py-3 max-w-[220px]">
                <span
                  className="block truncate text-theme-sm text-gray-600 dark:text-gray-300"
                  title={item.reason}
                >
                  {item.reason}
                </span>
              </td>
              <td className="px-4 py-3 pr-5">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={item.status} />
                  {item.status === "REJECTED" && item.hrNote ? (
                    <span className="text-[11px] text-error-600 dark:text-error-400 whitespace-normal break-words">
                      Note: {item.hrNote}
                    </span>
                  ) : null}
                  {item.status === "APPROVED" && item.hrNote ? (
                    <span className="text-[11px] text-success-600 dark:text-success-400 whitespace-normal break-words">
                      Note: {item.hrNote}
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── My Permissions section ────────────────────────────────────────────────────

function MyPermissionsSection() {
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const { data, isPending } = useMyWorkPermissions(currentYear);
  const items: WorkPermission[] = data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* section title row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            My Permissions
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Request short-time leave within work hours (10:00 AM – 7:00 PM), up
            to 2 hours.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Request Permission
        </Button>
      </div>

      {/* history */}
      <div className="flex flex-col gap-3">
        <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
          Permission history
        </h3>

        {isPending ? (
          <TableSkeleton rowsCount={4} columnsCount={5} />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              title="No permission requests yet"
              description="Request a permission to leave early or step out for a few hours."
            />
          </Card>
        ) : (
          <HistoryTable items={items} />
        )}
      </div>

      {open && <RequestDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPermissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <HrPageHeader
        title="Permissions"
        description="Request short-time leave approvals from your manager during work hours."
        icon={ShieldCheck}
      />

      <MyPermissionsSection />
    </div>
  );
}
