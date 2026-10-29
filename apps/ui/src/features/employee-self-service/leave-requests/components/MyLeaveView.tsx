"use client";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import {
  Briefcase,
  CalendarDays,
  Clock,
  Heart,
  Plus,
  RotateCcw,
  Star,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useHolidays } from "@/features/hr/holidays/hooks";
import { READ as HOLIDAY_READ } from "@/features/hr/holidays/permissions";
import {
  useMyLeaveBalances,
  useMyLeaveRequests,
  useResubmitMyLeaveRequest,
} from "@/features/hr/leaves/hooks";
import { CancelLeaveDialog } from "@/features/hr/leaves/components/CancelLeaveDialog";
import { RequestLeaveDialog } from "@/features/hr/leaves/components/RequestLeaveDialog";
import {
  DAY_PORTION_LABELS,
  STATUS_COLOR,
  STATUS_LABELS,
  canCancel,
  canResubmit,
} from "@/features/hr/leaves/status";
import type {
  LeaveBalanceItem,
  LeaveRequestItem,
} from "@/features/hr/leaves/types";

interface LeaveMeta {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  bar: string;
}

// Legacy Leave Tracker card palette (TexaWave_ERP_old
// src/modules/employee/MyLeaves.tsx LEAVE_META). Legacy had five fixed types;
// this ERP's leave types are configured by HR, so the palette is matched by
// the type's code where it fits and cycled otherwise.
const PALETTE: LeaveMeta[] = [
  {
    icon: Umbrella,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/60",
    bar: "bg-blue-600",
  },
  {
    icon: Heart,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900/60",
    bar: "bg-red-600",
  },
  {
    icon: Star,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-900/60",
    bar: "bg-green-600",
  },
  {
    icon: Clock,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-900/60",
    bar: "bg-purple-600",
  },
  {
    icon: Briefcase,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900/60",
    bar: "bg-amber-600",
  },
];

function metaFor(code: string, index: number): LeaveMeta {
  const c = code.toUpperCase();
  if (c.startsWith("CL") || c.includes("CASUAL")) return PALETTE[0]!;
  if (c.startsWith("SL") || c.includes("SICK")) return PALETTE[1]!;
  if (c.startsWith("PL") || c.startsWith("EL") || c.includes("PRIV"))
    return PALETTE[2]!;
  if (c.includes("COMP")) return PALETTE[3]!;
  if (c.includes("OD") || c.includes("DUTY")) return PALETTE[4]!;
  return PALETTE[index % PALETTE.length]!;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

function BalanceCard({
  balance,
  meta,
  onApply,
}: {
  balance: LeaveBalanceItem;
  meta: LeaveMeta;
  onApply: () => void;
}) {
  const total = balance.opening + balance.entitlement + balance.accrued;
  const booked = balance.used + balance.pending;
  const usedPct =
    total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const exists = !balance.isPaid || total > 0 || booked > 0;
  const barColor =
    usedPct > 75 ? "bg-red-400" : usedPct > 50 ? "bg-amber-400" : meta.bar;

  return (
    <button
      type="button"
      onClick={onApply}
      disabled={!exists}
      title={
        exists
          ? `Apply for ${balance.name}`
          : `${balance.name} is not available for you`
      }
      className={`rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900 ${meta.border}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bg}`}
        >
          <meta.icon className={`h-4 w-4 ${meta.color}`} aria-hidden="true" />
        </span>
        <span className={`text-xs font-semibold ${meta.color}`}>
          {balance.name}
        </span>
      </div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {balance.available ?? "—"}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {balance.available === null ? "Unpaid" : "Available"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
            {booked}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Booked</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </button>
  );
}

function ApplicationRow({
  app,
  meta,
  onCancel,
}: {
  app: LeaveRequestItem;
  meta: LeaveMeta;
  onCancel: () => void;
}) {
  const resubmit = useResubmitMyLeaveRequest();
  const { toast } = useToast();
  const reviewer = app.decidedBy ?? app.firstDecidedBy;
  const reviewedAt = app.decidedAt ?? app.firstDecidedAt;
  const note = app.decisionNote ?? app.firstDecisionNote;

  async function handleResubmit() {
    try {
      await resubmit.mutateAsync(app.id);
      toast({ title: "Leave request resubmitted", variant: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not resubmit request",
        variant: "error",
      });
    }
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 transition-all hover:shadow-md ${meta.border} ${meta.bg}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900">
        <meta.icon className={`h-4 w-4 ${meta.color}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${meta.color}`}>
            {app.leaveType.name}
          </p>
          {app.status === "PENDING" && app.awaiting === "HR" ? (
            <StatusBadge label="Awaiting HR" colorToken="brand" />
          ) : (
            <StatusBadge
              label={STATUS_LABELS[app.status]}
              colorToken={STATUS_COLOR[app.status]}
            />
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {app.startDate === app.endDate
            ? app.startDate
            : `${app.startDate} → ${app.endDate}`}{" "}
          · {daysLabel(app.leaveDays)}
          {app.dayPortion !== "FULL"
            ? ` · ${DAY_PORTION_LABELS[app.dayPortion]}`
            : ""}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {app.reason}
        </p>
        {note ? (
          <div
            className={`mt-1.5 rounded border px-2 py-1 text-xs ${
              app.status === "APPROVED"
                ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <span className="font-semibold">HR Note: </span>
            {note}
          </div>
        ) : null}
        {app.status === "CANCELLED" && app.cancellationNote ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Cancelled: {app.cancellationNote}
          </p>
        ) : null}
        {reviewer ? (
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {app.status === "APPROVED" ? "Approved" : "Reviewed"} by{" "}
            {reviewer.fullName}
            {reviewedAt ? ` · ${shortDate(reviewedAt)}` : ""}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {canCancel(app) ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {canResubmit(app) ? (
          <Button
            variant="ghost"
            size="sm"
            loading={resubmit.isPending}
            onClick={() => void handleResubmit()}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Resubmit
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function UpcomingHolidays() {
  const canRead = usePermission(HOLIDAY_READ);
  const holidays = useHolidays(
    { page: 1, limit: 8, from: todayIso(), isActive: true },
    canRead,
  );
  const today = todayIso();
  const rows = (holidays.data?.data ?? [])
    .filter((h) => h.holidayDate >= today)
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))
    .slice(0, 8);

  return (
    <Card className="lg:col-span-2">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
        Upcoming Holidays
      </h2>
      {!canRead ? (
        <p className="py-8 text-center text-xs text-gray-500">
          Holiday calendar is not available for your role.
        </p>
      ) : holidays.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : holidays.isError ? (
        <ErrorState onRetry={() => void holidays.refetch()} />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <Star
            className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600"
            aria-hidden="true"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No upcoming holidays
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((h) => {
            const d = new Date(`${h.holidayDate}T00:00:00`);
            const now = new Date(`${today}T00:00:00`);
            const daysLeft = Math.round((d.getTime() - now.getTime()) / 864e5);
            return (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 p-2.5 transition-all hover:shadow-md dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <span className="text-sm font-bold leading-tight text-amber-700 dark:text-amber-300">
                    {d.getDate()}
                  </span>
                  <span className="text-[10px] font-medium uppercase leading-none text-amber-600 dark:text-amber-400">
                    {new Intl.DateTimeFormat("en-IN", {
                      month: "short",
                    }).format(d)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-amber-900 dark:text-amber-200">
                    {h.name}
                  </span>
                  <span className="block text-xs text-amber-600 dark:text-amber-400">
                    {new Intl.DateTimeFormat("en-IN", {
                      weekday: "long",
                    }).format(d)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-800/60 dark:text-amber-100">
                  {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * The employee's Leave Tracker, laid out like the legacy one
 * (TexaWave_ERP_old src/modules/employee/MyLeaves.tsx): header with
 * "Apply Leave", a "Leave Summary · YEAR" grid of per-type balance cards
 * (click one to apply for that type), then Leave Applications beside
 * Upcoming Holidays.
 */
export function MyLeaveView() {
  const year = new Date().getFullYear();
  const balances = useMyLeaveBalances();
  const requests = useMyLeaveRequests({ page: 1, limit: 100 });
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyType, setApplyType] = useState<number | undefined>(undefined);
  const [applyKey, setApplyKey] = useState(0);
  const [cancelling, setCancelling] = useState<LeaveRequestItem | null>(null);

  function openApply(leaveTypeId?: number) {
    setApplyType(leaveTypeId);
    setApplyKey((k) => k + 1);
    setApplyOpen(true);
  }

  if (requests.isError) {
    const error = requests.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to leave requests"
        />
      );
    }
  }

  const balanceRows = balances.data ?? [];
  const metaByType = new Map(
    balanceRows.map((b, i) => [b.leaveTypeId, metaFor(b.code, i)]),
  );
  const appMeta = (app: LeaveRequestItem) =>
    metaByType.get(app.leaveType.id) ??
    metaFor(app.leaveType.code, app.leaveType.id);
  const apps = [...(requests.data?.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Leave Tracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your leaves and view balances
          </p>
        </div>
        <Button onClick={() => openApply()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Apply Leave
        </Button>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Leave Summary · {year}
        </p>
        {balances.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : balances.isError ? (
          <ErrorState onRetry={() => void balances.refetch()} />
        ) : balanceRows.length === 0 ? (
          <Card>
            <EmptyState
              title="No leave types configured"
              description="Ask HR to set up leave types and entitlements."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {balanceRows.map((b, i) => (
              <BalanceCard
                key={b.leaveTypeId}
                balance={b}
                meta={metaFor(b.code, i)}
                onApply={() => openApply(b.leaveTypeId)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <CalendarDays
              className="h-4 w-4 text-brand-500"
              aria-hidden="true"
            />
            Leave Applications
          </h2>
          {requests.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : requests.isError ? (
            <ErrorState onRetry={() => void requests.refetch()} />
          ) : apps.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays
                className="mx-auto mb-2 h-10 w-10 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No leave applications yet
              </p>
              <Button size="sm" className="mt-2" onClick={() => openApply()}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                Apply Leave
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {apps.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  meta={appMeta(app)}
                  onCancel={() => setCancelling(app)}
                />
              ))}
            </ul>
          )}
        </Card>

        <UpcomingHolidays />
      </div>

      {applyOpen ? (
        <RequestLeaveDialog
          key={applyKey}
          open
          onClose={() => setApplyOpen(false)}
          {...(applyType !== undefined
            ? { initialLeaveTypeId: applyType }
            : {})}
        />
      ) : null}
      {cancelling ? (
        <CancelLeaveDialog
          open
          request={cancelling}
          onClose={() => setCancelling(null)}
        />
      ) : null}
    </div>
  );
}
