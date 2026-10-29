"use client";

import { Button, Card } from "@texawave-erp/ui-kit";
import { LogIn, LogOut } from "lucide-react";
import { msToHM, type TodayAttendance } from "../useTodayAttendance";

/**
 * The legacy employee dashboard's "attendance clock" card (TexaWave_ERP_old
 * src/modules/employee/EmployeeDashboard.tsx): a big running "total time
 * today" stopwatch, one Check In / Check Out button whose label follows the
 * day's state, and a timeline of today's sessions.
 *
 * `centered` renders the single-column variant the legacy Check In / Out page
 * (WebCheckin.tsx) used. GPS capture is not shown: this ERP's check-in API
 * takes no location (the server stamps the time from the JWT).
 */
export function AttendanceClockCard({
  attendance,
  centered = false,
}: {
  attendance: TodayAttendance;
  centered?: boolean;
}) {
  const {
    canPunch,
    isCheckedIn,
    hasAnySession,
    sessions,
    totalElapsed,
    checkingIn,
    checkingOut,
    handleCheckIn,
    handleCheckOut,
  } = attendance;
  const lastSession = sessions[sessions.length - 1];

  const tone = isCheckedIn
    ? "border-2 border-amber-300 bg-linear-to-br from-amber-50 to-orange-50 dark:border-amber-700/60 dark:from-amber-950/30 dark:to-orange-950/20"
    : hasAnySession
      ? "border-2 border-brand-300/60 bg-linear-to-br from-brand-50/60 to-sky-50 dark:border-brand-800/60 dark:from-brand-950/30 dark:to-gray-900"
      : "border-2 border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";

  const clockColor = isCheckedIn
    ? "text-amber-600 dark:text-amber-400"
    : hasAnySession
      ? "text-brand-600 dark:text-brand-400"
      : "text-gray-300 dark:text-gray-600";

  const heading = isCheckedIn
    ? "Currently Working"
    : hasAnySession
      ? "Total Time Today"
      : "Today's Attendance";

  const actionButton = canPunch ? (
    isCheckedIn ? (
      <Button
        variant="ghost"
        size="lg"
        onClick={() => void handleCheckOut()}
        disabled={checkingOut}
        className="h-16 w-48 gap-2 rounded-2xl bg-amber-500 text-base font-bold text-white shadow-lg hover:bg-amber-600 active:scale-95 dark:text-white dark:hover:bg-amber-600"
      >
        <LogOut className="h-5 w-5" />
        {checkingOut ? "Checking out..." : "Check Out"}
      </Button>
    ) : (
      <Button
        size="lg"
        onClick={() => void handleCheckIn()}
        disabled={checkingIn}
        className="h-16 w-48 gap-2 rounded-2xl text-base font-bold shadow-lg active:scale-95"
      >
        <LogIn className="h-5 w-5" />
        {checkingIn
          ? "Checking in..."
          : hasAnySession
            ? "Check In Again"
            : "Check In"}
      </Button>
    )
  ) : null;

  return (
    <Card
      tone="none"
      className={`p-0 shadow-md transition-shadow hover:shadow-lg ${tone}`}
    >
      <div
        className={
          centered
            ? "flex flex-col items-center gap-5 p-6 text-center"
            : "flex flex-col items-center gap-5 p-6 sm:flex-row sm:gap-6"
        }
      >
        <div
          className={
            centered
              ? "flex flex-col items-center"
              : "flex flex-col items-center text-center sm:items-start sm:text-left"
          }
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {heading}
          </p>
          <div className={`relative flex items-center gap-2 ${clockColor}`}>
            {isCheckedIn ? (
              <span
                aria-hidden="true"
                className="absolute -left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 animate-pulse rounded-full bg-amber-400"
              />
            ) : null}
            <span
              className={`font-mono font-bold tracking-tight ${
                hasAnySession ? "text-5xl" : "text-4xl"
              }`}
            >
              {totalElapsed}
            </span>
          </div>
          {hasAnySession ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                {sessions.length} session{sessions.length > 1 ? "s" : ""} today
              </span>
              {isCheckedIn && lastSession ? (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Since {lastSession.checkIn}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {actionButton ? (
          <div
            className={
              centered
                ? "flex flex-col items-center gap-3"
                : "flex w-full flex-col items-center gap-3 sm:ml-auto sm:w-auto"
            }
          >
            {actionButton}
          </div>
        ) : null}
      </div>

      {sessions.length > 0 ? (
        <div className="border-t border-gray-200/70 px-6 py-4 text-left dark:border-gray-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Today&apos;s Sessions
          </p>
          <ul className="space-y-2">
            {sessions.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-16 text-xs text-gray-500 dark:text-gray-400">
                  Session {i + 1}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                    <LogIn
                      className="h-2.5 w-2.5 text-white"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {s.checkIn}
                  </span>
                </span>
                {s.checkOut ? (
                  <>
                    <span className="text-xs text-gray-400" aria-hidden="true">
                      →
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-400">
                        <LogOut
                          className="h-2.5 w-2.5 text-white"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {s.checkOut}
                      </span>
                    </span>
                    {s.durationMs !== null ? (
                      <span className="ml-auto rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:text-gray-400">
                        {msToHM(s.durationMs)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="ml-auto rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Active
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
