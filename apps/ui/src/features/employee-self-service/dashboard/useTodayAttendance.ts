"use client";

import { ApiError } from "@texawave-erp/core";
import { useToast } from "@texawave-erp/ui-kit";
import { useEffect, useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  useCheckIn,
  useCheckOut,
  useMyAttendance,
} from "@/features/hr/attendance/hooks";
import {
  SELF_SERVICE_PUNCH,
  SELF_SERVICE_READ,
} from "@/features/hr/attendance/permissions";
import { formatTime } from "@/features/hr/attendance/status";
import type { AttendanceDayView } from "@/features/hr/attendance/types";

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(d);
}

export function todayIso(): string {
  return isoDate(new Date());
}

function monthStartIso(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** ms → "HH:MM:SS" (legacy EmployeeDashboard `msToHMS`). */
export function msToHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** ms → "Xh Ym" / "Ym" (legacy EmployeeDashboard `msToHM`). */
export function msToHM(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function describePunchError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "ALREADY_CHECKED_IN") {
      return "You are already checked in.";
    }
    if (error.errorCode === "NOT_CHECKED_IN") return "You are not checked in.";
    if (error.isPermissionError) {
      return "You don't have permission to punch attendance.";
    }
    return error.message;
  }
  return "Failed to save attendance. Please try again.";
}

export interface TodaySession {
  checkIn: string;
  checkOut: string | null;
  durationMs: number | null;
}

/**
 * Today's attendance for the signed-in employee, shaped like the legacy
 * dashboard's live clock: every session of today, a running "total time
 * today" stopwatch, and check-in / check-out actions. Also returns this
 * month's Present / Absent / Leave counts for the legacy stats row — one
 * request covers both (month start → today, at most 31 rows).
 */
export function useTodayAttendance() {
  const canRead = usePermission(SELF_SERVICE_READ);
  const canPunch = usePermission(SELF_SERVICE_PUNCH);
  const { toast } = useToast();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const today = todayIso();
  const month = useMyAttendance(
    { page: 1, limit: 31, from: monthStartIso(), to: today },
    canRead,
  );

  const rows: AttendanceDayView[] = useMemo(
    () => month.data?.data ?? [],
    [month.data],
  );
  const todayRow = rows.find((r) => r.attendanceDate === today);
  const rawSessions = todayRow?.sessions ?? [];
  const isCheckedIn = todayRow?.hasOpenSession ?? false;
  const hasAnySession = rawSessions.length > 0;

  const completedMs = rawSessions.reduce(
    (sum, s) =>
      s.checkOutAt
        ? sum + (Date.parse(s.checkOutAt) - Date.parse(s.checkInAt))
        : sum,
    0,
  );
  const openStart = rawSessions.find((s) => !s.checkOutAt)?.checkInAt ?? null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!openStart) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openStart]);

  const totalElapsed = msToHMS(
    completedMs + (openStart ? Math.max(0, now - Date.parse(openStart)) : 0),
  );

  const sessions: TodaySession[] = rawSessions.map((s) => ({
    checkIn: formatTime(s.checkInAt),
    checkOut: s.checkOutAt ? formatTime(s.checkOutAt) : null,
    durationMs: s.checkOutAt
      ? Date.parse(s.checkOutAt) - Date.parse(s.checkInAt)
      : null,
  }));

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    for (const r of rows) {
      if (r.status === "PRESENT" || r.status === "HALF_DAY") present++;
      else if (r.status === "ABSENT") absent++;
      else if (r.status === "ON_LEAVE") leave++;
    }
    return { present, absent, leave };
  }, [rows]);

  async function handleCheckIn() {
    try {
      const res = await checkIn.mutateAsync();
      toast({
        title: `Checked in at ${formatTime(res.checkInAt)}`,
        variant: "success",
      });
    } catch (error) {
      toast({ title: describePunchError(error), variant: "error" });
    }
  }

  async function handleCheckOut() {
    try {
      const res = await checkOut.mutateAsync();
      toast({
        title: `Checked out at ${formatTime(res.checkOutAt)}`,
        variant: "success",
      });
    } catch (error) {
      toast({ title: describePunchError(error), variant: "error" });
    }
  }

  return {
    canRead,
    canPunch,
    query: month,
    isCheckedIn,
    hasAnySession,
    sessions,
    totalElapsed,
    summary,
    checkingIn: checkIn.isPending,
    checkingOut: checkOut.isPending,
    handleCheckIn,
    handleCheckOut,
  };
}

export type TodayAttendance = ReturnType<typeof useTodayAttendance>;
