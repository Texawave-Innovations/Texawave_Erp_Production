"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Flag,
  Hourglass,
  Layers,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { TimelineSession, TodayAttendance } from "../useTodayAttendance";

/**
 * The employee dashboard's hero "Time Tracker": an animated analog clock and
 * today's attendance stopwatch, with check-in / check-out on the card.
 *
 * - The clock shows the current IST time. Its hands turn by angles counted
 *   from IST midnight (not wrapping each lap), so the second hand always moves
 *   forward with a small spring "tick"; minute and hour hands glide.
 * - The bezel fills toward today's target from the HR master, with a glowing
 *   head at the end of the arc.
 * - Worked time ticks digit by digit (`animate-reveal`); a day timeline shows
 *   each session, with a pulsing "now" marker on the open one.
 * - Light blobs drift and the wave lines sway behind it (SVG SMIL, so no new
 *   CSS). Everything is still for prefers-reduced-motion.
 */

const IST_OFFSET_S = 5.5 * 3600;
const DIAL = 216;
const C = DIAL / 2;
const ARC_R = C - 7;
const TICK_OUT = C - 17;

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const m = window.matchMedia(MOTION_QUERY);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

/** Current time, ticking every second; null until mounted (SSR-safe). */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = requestAnimationFrame(() => setNow(Date.now()));
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(id);
    };
  }, []);
  return now;
}

/** "9:07 PM" — upper-case, matching the check-in times from formatTime. */
function clockTime(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .toUpperCase();
}

function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

// ── Clock ───────────────────────────────────────────────────────────────────

function Hand({
  deg,
  length,
  width,
  tail,
  className,
  transition,
}: {
  deg: number;
  length: number;
  width: number;
  tail: number;
  className: string;
  transition: string | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ transform: `rotate(${deg}deg)`, transition }}
    >
      <span
        className={`absolute left-1/2 -translate-x-1/2 rounded-full ${className}`}
        style={{
          width,
          height: length + tail,
          bottom: `calc(50% - ${tail}px)`,
        }}
      />
    </div>
  );
}

function AnalogClock({
  now,
  percent,
  working,
  still,
}: {
  now: number | null;
  /** 0–100 progress toward today's target; null = no target. */
  percent: number | null;
  working: boolean;
  still: boolean;
}) {
  const p = Math.min(100, Math.max(0, percent ?? 0));
  // Angles count up from IST midnight rather than wrapping each lap, so a CSS
  // transition never spins a hand backwards at :00. (Counting from the epoch
  // instead gives ~1e10° — browsers round that to 6 significant digits and the
  // second hand stops ticking.) The one wrap, at midnight, skips the animation.
  const daySec =
    now === null
      ? 0
      : ((Math.floor(now / 1000 + IST_OFFSET_S) % 86_400) + 86_400) % 86_400;
  const secDeg = daySec * 6;
  const minDeg = daySec / 10;
  const hourDeg = daySec / 120;
  const animate = !still && daySec > 1;

  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: DIAL, height: DIAL }}
    >
      <svg
        viewBox={`0 0 ${DIAL} ${DIAL}`}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {/* Glass face */}
        <circle
          cx={C}
          cy={C}
          r={TICK_OUT + 5}
          fill="rgba(255,255,255,0.12)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
        />
        {/* Bezel: progress toward today's target */}
        <circle
          cx={C}
          cy={C}
          r={ARC_R}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="6"
        />
        {percent !== null && (
          <circle
            cx={C}
            cy={C}
            r={ARC_R}
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            strokeDashoffset={100 - p}
            transform={`rotate(-90 ${C} ${C})`}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
          />
        )}
        {/* Minute ticks; hour ticks longer */}
        {Array.from({ length: 60 }, (_, i) => {
          const hour = i % 5 === 0;
          const a = (i * Math.PI) / 30;
          const r2 = TICK_OUT - (hour ? 10 : 5);
          return (
            <line
              key={i}
              x1={C + TICK_OUT * Math.sin(a)}
              y1={C - TICK_OUT * Math.cos(a)}
              x2={C + r2 * Math.sin(a)}
              y2={C - r2 * Math.cos(a)}
              stroke="#ffffff"
              strokeOpacity={hour ? 0.95 : 0.4}
              strokeWidth={hour ? 2.4 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
        {[12, 3, 6, 9].map((n) => {
          const a = (n * Math.PI) / 6;
          const r = TICK_OUT - 24;
          return (
            <text
              key={n}
              x={C + r * Math.sin(a)}
              y={C - r * Math.cos(a)}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize="14"
              fontWeight="700"
            >
              {n}
            </text>
          );
        })}
      </svg>

      {/* Glowing head at the end of the progress arc */}
      {percent !== null && p > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-1000 ease-linear motion-reduce:transition-none"
          style={{ transform: `rotate(${(p / 100) * 360}deg)` }}
        >
          <span
            className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_5px_rgba(255,255,255,0.7)]"
            style={{ top: C - ARC_R - 7 }}
          />
        </div>
      )}

      {now !== null && (
        <>
          <Hand
            deg={hourDeg}
            length={46}
            width={6}
            tail={10}
            className="bg-white shadow-md"
            transition={animate ? "transform 1s linear" : undefined}
          />
          <Hand
            deg={minDeg}
            length={68}
            width={4}
            tail={12}
            className="bg-white/95 shadow-md"
            transition={animate ? "transform 1s linear" : undefined}
          />
          <Hand
            deg={secDeg}
            length={78}
            width={2}
            tail={20}
            className="bg-cyan-200 shadow-[0_0_8px_rgba(165,243,252,0.9)]"
            transition={
              animate
                ? "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)"
                : undefined
            }
          />
        </>
      )}

      {/* Centre cap; a soft pulse while the clock is running for you */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        {working && !still && (
          <span className="absolute h-6 w-6 rounded-full bg-white/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
        )}
        <span className="relative h-3.5 w-3.5 rounded-full bg-white ring-[3px] ring-cyan-200" />
      </div>
    </div>
  );
}

// ── Worked time & day timeline ──────────────────────────────────────────────

/** HH:MM:SS with each digit re-keyed so a change replays its entrance. */
function TickingTime({ value }: { value: string }) {
  return (
    <span
      className="flex items-baseline text-[2.6rem] font-bold leading-none tracking-tight tabular-nums"
      aria-hidden="true"
    >
      {value.split("").map((ch, i) =>
        ch === ":" ? (
          <span key={`sep-${i}`} className="px-0.5 text-white/60">
            :
          </span>
        ) : (
          <span
            key={`${i}-${ch}`}
            className="inline-block w-[0.62em] text-center animate-reveal"
          >
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

function hourLabel(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .toUpperCase();
}

function DayTimeline({
  sessions,
  now,
  working,
  still,
}: {
  sessions: TimelineSession[];
  now: number;
  working: boolean;
  still: boolean;
}) {
  const HOUR = 3_600_000;
  // IST midnight today, then a window of at least 9 AM – 7 PM that grows to
  // cover the first check-in and the current time.
  const istMidnight =
    Math.floor((now / 1000 + IST_OFFSET_S) / 86_400) * 86_400_000 -
    IST_OFFSET_S * 1000;
  const firstStart = sessions[0]?.start ?? now;
  const lastEnd = Math.max(now, ...sessions.map((s) => s.end ?? now));
  const from =
    Math.floor(Math.min(firstStart, istMidnight + 9 * HOUR) / HOUR) * HOUR;
  const to =
    Math.ceil(Math.max(lastEnd + HOUR / 2, istMidnight + 19 * HOUR) / HOUR) *
    HOUR;
  const pos = (t: number) =>
    Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100));

  return (
    <div className="relative">
      <div className="relative h-2.5 rounded-full bg-white/20">
        {sessions.map((s, i) => {
          const left = pos(s.start);
          const right = pos(s.end ?? now);
          return (
            <span
              key={i}
              className={`absolute inset-y-0 rounded-full ${
                s.counted ? "bg-white" : "bg-white/40"
              } ${s.end === null && !still ? "shadow-[0_0_10px_rgba(255,255,255,0.8)]" : ""}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(1, right - left)}%`,
              }}
            />
          );
        })}
        {working && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos(now)}%` }}
            aria-hidden="true"
          >
            {!still && (
              <span className="absolute -inset-1.5 rounded-full bg-white/50 animate-ping" />
            )}
            <span className="relative block h-3.5 w-3.5 rounded-full bg-white ring-2 ring-cyan-200" />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-white/80">
        <span>{hourLabel(from)}</span>
        <span>{hourLabel(from + (to - from) / 2)}</span>
        <span>{hourLabel(to)}</span>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: typeof Flag;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm animate-reveal ${className}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
          {label}
        </p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Background ──────────────────────────────────────────────────────────────

function Backdrop({ still }: { still: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
      </defs>
      <g filter={`url(#${id}-blur)`}>
        <circle cx="70" cy="50" r="80" fill="#22d3ee" opacity="0.45">
          {!still && (
            <animate
              attributeName="cx"
              values="70;160;70"
              dur="14s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <circle cx="340" cy="220" r="105" fill="#1d4ed8" opacity="0.5">
          {!still && (
            <animate
              attributeName="cy"
              values="220;150;220"
              dur="17s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <circle cx="300" cy="40" r="60" fill="#ffffff" opacity="0.16">
          {!still && (
            <animate
              attributeName="r"
              values="60;90;60"
              dur="11s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </g>
      <g opacity="0.28">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M ${-30 + i * 14} 280 C ${80 + i * 16} ${200 - i * 9}, ${180 + i * 10} ${250 - i * 14}, 440 ${50 + i * 14}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.9"
          >
            {!still && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; -14 8; 0 0"
                dur={`${9 + i}s`}
                repeatCount="indefinite"
              />
            )}
          </path>
        ))}
      </g>
    </svg>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

export function TimeTrackerCard({
  attendance,
  targetMinutes,
  children,
}: {
  attendance: TodayAttendance;
  /** Today's target from the HR master; null when none is set or readable. */
  targetMinutes: number | null;
  /** Loading / error / no-access state, shown instead of the tracker. */
  children?: ReactNode;
}) {
  const {
    canRead,
    canPunch,
    isCheckedIn,
    hasAnySession,
    sessions,
    timeline,
    totalElapsed,
    totalMs,
    checkingIn,
    checkingOut,
    handleCheckIn,
    handleCheckOut,
  } = attendance;
  const now = useNow();
  const still = useReducedMotion();
  const ready = canRead && attendance.query.data !== undefined;
  const lastSession = sessions[sessions.length - 1];
  const target =
    targetMinutes !== null && targetMinutes > 0 ? targetMinutes : null;
  const percent = target !== null ? (totalMs / (target * 60_000)) * 100 : null;
  const leftMin = target !== null ? target - totalMs / 60_000 : null;
  const targetMet = leftMin !== null && leftMin <= 0;

  const status = isCheckedIn
    ? { label: targetMet ? "Target met" : "Working", pulse: true }
    : hasAnySession
      ? { label: "Checked out", pulse: false }
      : { label: "Not checked in", pulse: false };

  const caption =
    target !== null ? `of ${duration(target)} today` : "worked today";

  const details: { icon: typeof Flag; label: string; value: string }[] = [];
  if (isCheckedIn && lastSession) {
    details.push({
      icon: LogIn,
      label: "Checked in",
      value: lastSession.checkIn,
    });
  } else if (hasAnySession && lastSession) {
    details.push({
      icon: LogOut,
      label: "Last check-out",
      value: lastSession.checkOut ?? "—",
    });
  }
  if (leftMin !== null) {
    details.push({
      icon: Hourglass,
      label: targetMet ? "Over target" : "Time left",
      value: targetMet ? `+${duration(-leftMin)}` : duration(leftMin),
    });
  }
  if (isCheckedIn && leftMin !== null && !targetMet && now !== null) {
    details.push({
      icon: Flag,
      label: "Expected finish",
      value: clockTime(now + leftMin * 60_000),
    });
  } else {
    details.push({
      icon: Layers,
      label: "Sessions",
      value: hasAnySession ? `${sessions.length} today` : "None yet",
    });
  }

  const button =
    "relative inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:scale-100";

  return (
    <section
      aria-labelledby="self-tracker-heading"
      className="relative flex w-full flex-col overflow-hidden rounded-3xl bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 p-5 text-white shadow-xl shadow-sky-500/30 sm:p-6"
    >
      <Backdrop still={still} />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h2 id="self-tracker-heading" className="text-lg font-semibold">
            Time Tracker
          </h2>
          <p className="min-h-4 text-xs text-white/80">
            {now === null
              ? ""
              : new Date(now).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Asia/Kolkata",
                })}
          </p>
        </div>
        {ready && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/30 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              {status.pulse && !still && (
                <span className="absolute inset-0 rounded-full bg-white animate-ping" />
              )}
              <span
                className={`relative h-2 w-2 rounded-full bg-white ${status.pulse ? "" : "opacity-60"}`}
              />
            </span>
            {status.label}
          </span>
        )}
      </div>

      {ready ? (
        <div className="relative mt-4 flex flex-1 flex-col gap-5">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <AnalogClock
              now={now}
              percent={percent}
              working={isCheckedIn}
              still={still}
            />

            <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-3 sm:items-start">
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  {isCheckedIn
                    ? "Working now"
                    : hasAnySession
                      ? "Worked today"
                      : "Today"}
                </p>
                <TickingTime value={totalElapsed} />
                <span className="sr-only">
                  {totalElapsed} {caption}
                </span>
                <p className="mt-1 text-xs font-medium text-white/90">
                  {caption}
                  {percent !== null && (
                    <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                      {Math.min(999, Math.round(percent))}%
                    </span>
                  )}
                </p>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-1 lg:grid-cols-2">
                {details.map((d, i) => (
                  <Detail
                    key={d.label}
                    {...d}
                    className={
                      i === 2
                        ? "min-[420px]:col-span-2 sm:col-span-1 lg:col-span-2"
                        : ""
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {now !== null && (hasAnySession || isCheckedIn) && (
            <DayTimeline
              sessions={timeline}
              now={now}
              working={isCheckedIn}
              still={still}
            />
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
            <p className="text-xs font-medium text-white/90" aria-live="polite">
              {isCheckedIn
                ? "Your clock is running. Check out when you finish."
                : hasAnySession
                  ? "Checked out. Check in again to resume."
                  : "Check in to start today's clock."}
            </p>
            {canPunch ? (
              isCheckedIn ? (
                <button
                  type="button"
                  onClick={() => void handleCheckOut()}
                  disabled={checkingOut}
                  className={`${button} bg-white text-[#0284c7]`}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {checkingOut ? "Checking out…" : "Check Out"}
                </button>
              ) : (
                <span className="relative inline-flex">
                  {!still && !checkingIn && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-white/50 animate-[ping_2.2s_cubic-bezier(0,0,0.2,1)_infinite]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCheckIn()}
                    disabled={checkingIn}
                    className={`${button} bg-white text-[#0284c7]`}
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    {checkingIn
                      ? "Checking in…"
                      : hasAnySession
                        ? "Check In Again"
                        : "Check In"}
                  </button>
                </span>
              )
            ) : (
              <Link
                href="/portal/attendance"
                className={`${button} bg-white/20 text-white ring-1 ring-white/50`}
              >
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                My attendance
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="relative mt-4 flex flex-1 flex-col justify-center rounded-2xl bg-white p-3 text-gray-700">
          {children}
        </div>
      )}
    </section>
  );
}
