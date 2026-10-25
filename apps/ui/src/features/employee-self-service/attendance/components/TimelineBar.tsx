"use client";

import { useEffect, useState } from "react";
import type { AttendanceSession } from "@/features/hr/attendance/types";
import { TL_LABELS, hourPct, time12, timePct } from "../attendance-utils";

/**
 * One day's punches on a 9 AM – 9 PM track (legacy MyAttendance.tsx
 * TimelineBar): the 10 AM – 7 PM shift window shaded, a bar per session
 * (sky for a regularized/HR-corrected session), amber break gaps, in/out
 * dots, and a live, pulsing edge for today's open session.
 */
export function TimelineBar({
  sessions,
  isWeekend,
  isLiveToday,
}: {
  sessions: readonly AttendanceSession[];
  isWeekend: boolean;
  isLiveToday: boolean;
}) {
  const [livePct, setLivePct] = useState(() => timePct(new Date()));
  useEffect(() => {
    if (!isLiveToday) return;
    const t = setInterval(() => setLivePct(timePct(new Date())), 30_000);
    return () => clearInterval(t);
  }, [isLiveToday]);

  if (isWeekend) {
    return (
      <div className="relative flex h-9 w-full items-center">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
        <span className="relative z-10 mx-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800">
          Weekend Off
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex h-9 w-full select-none items-center px-1">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-100 shadow-inner dark:bg-slate-800/80" />
      <div
        className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200/60 dark:bg-slate-700/50"
        style={{
          left: `${hourPct(10)}%`,
          width: `${hourPct(19) - hourPct(10)}%`,
        }}
        title="Standard Shift Window (10:00 AM - 7:00 PM)"
      />
      {TL_LABELS.map((h) => (
        <div
          key={h}
          className="absolute top-1/2 z-0 h-3 w-0.5 -translate-y-1/2 rounded-full bg-slate-300/80 dark:bg-slate-600"
          style={{ left: `${hourPct(h)}%` }}
        />
      ))}

      {sessions.length === 0
        ? TL_LABELS.map((h) => (
            <div
              key={`dot-${h}`}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 dark:bg-slate-700"
              style={{ left: `${hourPct(h)}%` }}
            />
          ))
        : sessions.map((s, i) => {
            const inPct = timePct(s.checkInAt);
            const outPct = s.checkOutAt ? timePct(s.checkOutAt) : null;
            const isActive = !s.checkOutAt && isLiveToday;
            const corrected = s.source === "CORRECTION" || s.source === "HR";
            const barGrad = corrected
              ? "from-sky-500 via-cyan-500 to-sky-600"
              : "from-emerald-500 via-teal-500 to-emerald-600";
            const next = sessions[i + 1];
            const breakEnd = next ? timePct(next.checkInAt) : null;
            return (
              <span key={s.id}>
                {outPct !== null ? (
                  <span
                    className={`absolute top-1/2 z-10 h-2.5 -translate-y-1/2 rounded-full bg-linear-to-r shadow-xs transition-all hover:h-3 ${barGrad}`}
                    style={{
                      left: `${inPct}%`,
                      width: `${Math.max(0.6, outPct - inPct)}%`,
                    }}
                    title={`Session ${i + 1}: ${time12(s.checkInAt)} - ${time12(s.checkOutAt!)}`}
                  />
                ) : null}
                {isActive ? (
                  <span
                    className="absolute top-1/2 z-10 h-2.5 -translate-y-1/2 animate-pulse rounded-full bg-linear-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-md"
                    style={{
                      left: `${inPct}%`,
                      width: `${Math.max(0.6, livePct - inPct)}%`,
                    }}
                    title={`Active Session: ${time12(s.checkInAt)} (Working Now)`}
                  />
                ) : null}
                {outPct !== null && breakEnd !== null && breakEnd > outPct ? (
                  <span
                    className="absolute top-1/2 z-10 h-2 -translate-y-1/2 rounded-full border border-amber-300/60 bg-linear-to-r from-amber-400 to-amber-500 opacity-90"
                    style={{
                      left: `${outPct}%`,
                      width: `${breakEnd - outPct}%`,
                    }}
                    title="Shift Break"
                  />
                ) : null}
                <span
                  className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 ${corrected ? "bg-sky-600" : "bg-emerald-600"}`}
                  style={{ left: `${inPct}%` }}
                  title={`Check In: ${time12(s.checkInAt)}`}
                />
                {outPct !== null ? (
                  <span
                    className={`absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 ${corrected ? "bg-cyan-500" : "bg-rose-500"}`}
                    style={{ left: `${outPct}%` }}
                    title={`Check Out: ${time12(s.checkOutAt!)}`}
                  />
                ) : null}
                {isActive ? (
                  <span
                    className="absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-white bg-emerald-400 shadow-md"
                    style={{ left: `${livePct}%` }}
                    title="Active Working Now"
                  />
                ) : null}
              </span>
            );
          })}
    </div>
  );
}
