"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatValue } from "../format";
import type { ChartData } from "../types";
import { STRIPES } from "./DashboardCard";

/** Bars rise from the baseline after mount; remounting (new category) replays it. */
function useGrown(): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return grown;
}

/**
 * Rounded "pill" column chart from the reference design. The tallest bar is
 * navy, the focused bar (hovered, or today/current month by default) is light
 * blue with a value chip, and empty bars are striped instead of invisible.
 */
export function PillBarChart({
  data,
  label,
}: {
  data: ChartData;
  label: string;
}) {
  const grown = useGrown();
  const [hover, setHover] = useState<number | null>(null);
  const bars = data.bars;

  if (bars.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-10 text-xs font-semibold text-gray-500 dark:text-gray-400">
        Nothing recorded yet.
      </p>
    );
  }

  const max = Math.max(...bars.map((b) => b.value), 0);
  const maxIndex = max > 0 ? bars.findIndex((b) => b.value === max) : -1;
  const focus = hover ?? data.focusIndex ?? null;

  return (
    <figure className="flex flex-1 flex-col" aria-label={label}>
      <div
        className="flex h-52 shrink-0 items-end justify-between gap-2 pt-8 sm:gap-3"
        onMouseLeave={() => setHover(null)}
      >
        {bars.map((bar, i) => {
          const ratio =
            bar.muted || max === 0 ? 0.62 : Math.max(0.16, bar.value / max);
          const isFocus = focus === i && !bar.muted;
          const tone = bar.muted
            ? "border border-slate-400/70 bg-white dark:border-slate-500 dark:bg-transparent"
            : i === maxIndex && !isFocus
              ? "bg-linear-to-t from-blue-600 via-sky-500 to-cyan-400"
              : isFocus
                ? "bg-cyan-300 dark:bg-cyan-400"
                : "bg-sky-400 dark:bg-sky-500";
          const body = (
            <>
              {isFocus && (
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0a3271] shadow-theme-xs dark:border-[#1C2029] dark:bg-[#161B26] dark:text-sky-100">
                  {formatValue(bar.value, data.format)}
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 translate-y-0.5 rounded-full border-2 border-white bg-sky-500 dark:border-[#161B26] dark:bg-sky-300"
                  />
                </span>
              )}
              <span
                className={`block w-full rounded-full transition-[height] duration-700 ease-out motion-reduce:transition-none ${tone}`}
                style={{
                  height: grown ? `${ratio * 100}%` : "0%",
                  transitionDelay: `${i * 70}ms`,
                  ...(bar.muted ? { backgroundImage: STRIPES } : {}),
                }}
              />
            </>
          );
          const common = {
            className:
              "relative flex h-full max-w-[56px] flex-1 items-end rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
            onMouseEnter: () => setHover(i),
            onFocus: () => setHover(i),
            onBlur: () => setHover(null),
            "aria-label": bar.full,
            title: bar.full,
          };
          return bar.href ? (
            <Link key={`${bar.label}-${i}`} href={bar.href} {...common}>
              {body}
            </Link>
          ) : (
            <span key={`${bar.label}-${i}`} tabIndex={0} {...common}>
              {body}
            </span>
          );
        })}
      </div>
      <div
        className="mt-2.5 flex justify-between gap-2 sm:gap-3"
        aria-hidden="true"
      >
        {bars.map((bar, i) => (
          <span
            key={`${bar.label}-${i}`}
            className={`max-w-[56px] flex-1 truncate text-center text-xs ${
              focus === i
                ? "font-bold text-[#0a3271] dark:text-sky-100"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
