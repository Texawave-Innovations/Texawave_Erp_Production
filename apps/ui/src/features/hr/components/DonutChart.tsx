"use client";

import { useState } from "react";

export const SEGMENT_STROKE = {
  brand: "stroke-brand-500",
  error: "stroke-error-500",
  warning: "stroke-warning-500",
  chart1: "stroke-chart-1",
  chart2: "stroke-chart-2",
  chart3: "stroke-chart-3",
  chart4: "stroke-chart-4",
  chart5: "stroke-chart-5",
} as const;

export const SEGMENT_FILL = {
  brand: "bg-brand-500",
  error: "bg-error-500",
  warning: "bg-warning-500",
  chart1: "bg-chart-1",
  chart2: "bg-chart-2",
  chart3: "bg-chart-3",
  chart4: "bg-chart-4",
  chart5: "bg-chart-5",
} as const;

export type SegmentTone = keyof typeof SEGMENT_STROKE;

export interface DonutSegment {
  label: string;
  value: number;
  tone: SegmentTone;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  label: string;
  size?: number;
}

/**
 * Dependency-free SVG Donut Chart with accessible role, screen reader table,
 * and smooth interactive segments. Conforms to Section 6, 11 & Docs/DESIGN_SYSTEM.md.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  label,
  size = 160,
}: DonutChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90 transition-transform"
        aria-hidden="true"
      >
        {/* Background Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="14"
          className="stroke-gray-100 dark:stroke-gray-800"
        />

        {/* Dynamic Segments */}
        {total > 0 &&
          segments.map((s) => {
            if (s.value <= 0) return null;
            const length = (s.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const dashOffset = -offset;
            offset += length;

            const isHovered = hoveredSegment === s.label;

            return (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth={isHovered ? 16 : 14}
                strokeDasharray={dash}
                strokeDashoffset={dashOffset}
                onMouseEnter={() => setHoveredSegment(s.label)}
                onMouseLeave={() => setHoveredSegment(null)}
                className={`transition-all duration-200 cursor-pointer ${SEGMENT_STROKE[s.tone]} ${
                  isHovered ? "opacity-100" : "opacity-90 hover:opacity-100"
                }`}
              />
            );
          })}
      </svg>

      {/* Central Metric Value & Label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        <span className="text-title-sm font-bold text-gray-900 dark:text-white/90 leading-tight">
          {centerValue}
        </span>
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
          {centerLabel}
        </span>
      </div>

      {/* Accessible Table for Screen Readers */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Donut = DonutChart;
