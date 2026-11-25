"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { initials } from "../format";
import type {
  ItemTone,
  ListItem,
  PersonRow,
  Reminder,
  Spotlight,
} from "../types";

const TONE_CHIP: Record<ItemTone, string> = {
  brand: "bg-brand-50 text-[#1769F5] dark:bg-brand-500/15 dark:text-brand-300",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  sky: "bg-sky-50 text-[#0284c7] dark:bg-sky-500/15 dark:text-sky-300",
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
  warning:
    "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

const TONE_BADGE: Record<ItemTone, string> = {
  brand:
    "border-brand-200 bg-brand-25 text-[#1769F5] dark:border-brand-500/30 dark:bg-transparent dark:text-brand-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-transparent dark:text-cyan-300",
  sky: "border-sky-200 bg-sky-50 text-[#0284c7] dark:border-sky-500/30 dark:bg-transparent dark:text-sky-300",
  success:
    "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-transparent dark:text-success-400",
  warning:
    "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-transparent dark:text-warning-400",
  error:
    "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-transparent dark:text-error-400",
  slate:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-transparent dark:text-slate-300",
};

export function Badge({
  tone,
  children,
}: {
  tone: ItemTone;
  children: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${TONE_BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

/** The right-hand list in the reference ("Project"): icon chip, title, sub-line, badge. */
export function ItemList({
  items,
  icon: Icon,
  empty,
}: {
  items: ListItem[];
  icon: LucideIcon;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-8 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
        {empty}
      </p>
    );
  }
  return (
    <ul className="-mx-2 space-y-1">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="animate-reveal"
          style={{ animationDelay: `${120 + i * 60}ms` }}
        >
          <Link
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-[#161B26]"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[item.tone]}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#0a3271] dark:text-sky-100">
                {item.title}
              </span>
              <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                {item.meta}
              </span>
            </span>
            {item.badge && <Badge tone={item.tone}>{item.badge}</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Reminders" card: the module's most time-sensitive item and one action. */
export function ReminderView({ reminder }: { reminder: Reminder }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="animate-reveal">
        {reminder.urgent && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[10px] font-semibold text-warning-700 dark:border-warning-500/30 dark:bg-transparent dark:text-warning-400">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Needs action
          </span>
        )}
        <p className="line-clamp-2 text-2xl font-semibold leading-snug text-[#0a3271] dark:text-sky-100">
          {reminder.headline}
        </p>
        {reminder.lines.map((line) => (
          <p
            key={line}
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {line}
          </p>
        ))}
      </div>
      <Link
        href={reminder.cta.href}
        className="flex items-center justify-center gap-2 rounded-full bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/25 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        {reminder.cta.label}
      </Link>
    </div>
  );
}

const AVATAR_TONES: Record<ItemTone, string> = {
  brand: "bg-brand-100 text-[#1769F5]",
  cyan: "bg-cyan-100 text-cyan-700",
  sky: "bg-sky-100 text-[#0284c7]",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  slate: "bg-slate-100 text-slate-600",
};

const AVATAR_CYCLE: readonly ItemTone[] = [
  "brand",
  "cyan",
  "sky",
  "success",
  "warning",
];

/** "Team Collaboration" card: avatar initials, name, sub-line and a status badge. */
export function PeopleList({
  rows,
  empty,
}: {
  rows: PersonRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-8 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {empty}
      </p>
    );
  }
  return (
    <ul className="-mx-2 space-y-1">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className="animate-reveal"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <Link
            href={r.href}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-[#161B26]"
          >
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_TONES[AVATAR_CYCLE[i % AVATAR_CYCLE.length] ?? "brand"]}`}
            >
              {initials(r.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#0a3271] dark:text-sky-100">
                {r.name}
              </span>
              <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                {r.sub}
              </span>
            </span>
            {r.badge && <Badge tone={r.tone}>{r.badge}</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function istClock(now: Date) {
  const time = now.toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  return { time, date };
}

/** Ticking IST clock; empty on the server and filled after mount, so SSR and the client agree. */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = requestAnimationFrame(() => setNow(new Date()));
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(id);
    };
  }, []);
  const clock = now ? istClock(now) : null;
  return (
    <>
      <p className="relative mt-4 text-center text-[2.5rem] font-semibold leading-none tracking-wide tabular-nums">
        {clock?.time ?? "--:--:--"}
      </p>
      <p className="relative mt-2 text-center text-xs text-white/90">
        {clock?.date ?? " "}
      </p>
    </>
  );
}

/** Dark highlight card (the reference's "Time Tracker"): one headline figure per module. */
export function SpotlightCard({
  title,
  spotlight,
  children,
}: {
  title: string;
  spotlight: Spotlight | null;
  /** Loading / error / no-access state, shown when `spotlight` is null. */
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="admin-spotlight-heading"
      className="relative flex flex-1 flex-col overflow-hidden rounded-3xl bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 p-5 text-white shadow-lg shadow-sky-500/25"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 200 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M ${-20 + i * 8} 170 C ${40 + i * 10} ${120 - i * 6}, ${90 + i * 6} ${150 - i * 10}, 220 ${30 + i * 9}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <div className="relative flex items-center justify-between">
        <h2 id="admin-spotlight-heading" className="text-lg font-semibold">
          {title}
        </h2>
        {spotlight?.value === null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
            <span
              className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Live
          </span>
        )}
      </div>

      {spotlight ? (
        <div className="relative flex flex-1 flex-col animate-reveal">
          {spotlight.value === null ? (
            <LiveClock />
          ) : (
            <p className="mt-4 text-center text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums">
              {spotlight.value}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-white/90">
            {spotlight.caption}
          </p>
          {spotlight.lines.map((line) => (
            <p
              key={line}
              className="mt-1 text-center text-xs font-semibold text-white"
            >
              {line}
            </p>
          ))}
          <div className="mt-auto flex justify-center gap-3 pt-4">
            {spotlight.actions.map((a, i) => (
              <Link
                key={a.href}
                href={a.href}
                aria-label={a.label}
                title={a.label}
                className={`flex h-11 w-11 items-center justify-center rounded-full shadow-theme-sm transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                  i === 0
                    ? "bg-white text-[#0284c7]"
                    : "bg-white/20 text-white ring-1 ring-white/50"
                }`}
              >
                <a.icon className="h-5 w-5" aria-hidden="true" />
              </Link>
            ))}
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
