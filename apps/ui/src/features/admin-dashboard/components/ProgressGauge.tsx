"use client";

import { useEffect, useId, useState } from "react";
import { AnimatedNumber } from "@texawave-erp/ui-kit";
import { formatValue } from "../format";
import type { GaugeData, GaugeKind } from "../types";
import { STRIPES } from "./DashboardCard";

/** Semicircle from (20,100) to (180,100), radius 80, drawn left to right. */
const ARC = "M 20 100 A 80 80 0 0 1 180 100";
/** Gap between segments, in the path's 0–100 length units. */
const GAP = 2.5;

const SWATCH: Record<GaugeKind, string> = {
  solid: "bg-sky-400",
  dark: "bg-blue-600 dark:bg-blue-500",
  striped: "border border-slate-400/70 bg-white dark:bg-transparent",
};

/**
 * Half-donut progress gauge from the reference: solid, dark and striped
 * segments sweep in from the left, with the headline percentage in the middle.
 */
export function ProgressGauge({
  data,
  label,
}: {
  data: GaugeData;
  label: string;
}) {
  const patternId = useId().replace(/:/g, "");
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const segments = data.segments.filter((s) => s.value > 0);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const gaps = Math.max(0, segments.length - 1) * GAP;
  const lengths = segments.map((s) =>
    total > 0 ? (s.value / total) * (100 - gaps) : 0,
  );
  const arcs = segments.map((s, i) => ({
    ...s,
    length: lengths[i] ?? 0,
    // Each arc starts after every earlier arc plus one gap per earlier arc.
    start: lengths.slice(0, i).reduce((sum, l) => sum + l + GAP, 0),
  }));

  const fmt = (v: number) => formatValue(v, data.format ?? "number");
  const summary = data.segments
    .map((s) => `${s.label} ${fmt(s.value)}`)
    .join(", ");

  return (
    <figure
      className="flex flex-1 flex-col items-center"
      aria-label={`${label}: ${data.percent}% ${data.caption}. ${summary}`}
    >
      <div className="relative w-full max-w-[260px]">
        <svg
          viewBox="0 0 200 112"
          className="w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={patternId}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width="7"
                height="7"
                className="fill-white dark:fill-[#0D1117]"
              />
              <rect width="2.6" height="7" className="fill-slate-400/80" />
            </pattern>
          </defs>
          <path
            d={ARC}
            pathLength={100}
            fill="none"
            strokeWidth={26}
            strokeLinecap="round"
            className="stroke-gray-100 dark:stroke-[#161B26]"
          />
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={ARC}
              pathLength={100}
              fill="none"
              strokeWidth={26}
              strokeLinecap="butt"
              stroke={a.kind === "striped" ? `url(#${patternId})` : undefined}
              className={`transition-[stroke-dasharray] duration-1000 ease-out motion-reduce:transition-none ${
                a.kind === "solid"
                  ? "stroke-sky-400"
                  : a.kind === "dark"
                    ? "stroke-blue-600 dark:stroke-blue-500"
                    : ""
              }`}
              style={{
                strokeDasharray: drawn
                  ? `0 ${a.start} ${a.length} 100`
                  : `0 ${a.start} 0 100`,
                transitionDelay: `${i * 160}ms`,
              }}
            />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p className="text-[2.4rem] font-bold leading-none text-[#0a3271] tabular-nums dark:text-sky-100">
            <AnimatedNumber
              value={data.percent}
              duration={1000}
              formatter={(v) => `${v}%`}
            />
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {data.caption}
          </p>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {data.segments.map((s) => (
          <li
            key={s.label}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full ${SWATCH[s.kind]}`}
              style={
                s.kind === "striped" ? { backgroundImage: STRIPES } : undefined
              }
            />
            {s.label}
            <span className="font-semibold text-[#0a3271] tabular-nums dark:text-sky-100">
              {fmt(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
