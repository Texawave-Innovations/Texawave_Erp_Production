"use client";

import { ChevronDown } from "lucide-react";
import { AnimatedNumber } from "@texawave-erp/ui-kit";

export interface DistributionSegment {
  name: string;
  percentage: number;
  color: string;
}

const DEFAULT_SEGMENTS: DistributionSegment[] = [
  { name: "Production", percentage: 28, color: "#38bdf8" }, // cyan
  { name: "Sales", percentage: 18, color: "#2dd4bf" }, // teal
  { name: "Finance", percentage: 12, color: "#f59e0b" }, // amber
  { name: "Marketing", percentage: 14, color: "#ec4899" }, // pink
  { name: "HR", percentage: 10, color: "#3b82f6" }, // blue
  { name: "Others", percentage: 18, color: "#8b5cf6" }, // purple
];

export interface EmployeeDistributionDonutProps {
  totalCount?: number | string;
  segments?: DistributionSegment[];
  className?: string;
}

export function EmployeeDistributionDonut({
  totalCount = "1,248",
  segments = DEFAULT_SEGMENTS,
  className = "",
}: EmployeeDistributionDonutProps) {
  const period = "This Year";

  // Calculate SVG stroke dashes for the donut ring
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const hasData = segments.length > 0 && segments.some((s) => s.percentage > 0);
  const ringSegments = hasData
    ? segments
    : [{ name: "No data", percentage: 100, color: "#cbd5e1" }];

  const renderedSegments = ringSegments.reduce<
    Array<
      DistributionSegment & {
        strokeDasharray: string;
        strokeDashoffset: number;
      }
    >
  >((accList, seg) => {
    const prevPercent = accList.reduce((sum, s) => sum + s.percentage, 0);
    const strokeDasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((prevPercent / 100) * circumference);
    accList.push({ ...seg, strokeDasharray, strokeDashoffset });
    return accList;
  }, []);

  return (
    <div
      className={`rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.03)] dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">
          Employee Distribution
        </h3>

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <span>{period}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Donut and Legend row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2 pb-1">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 140 140">
            {renderedSegments.map((seg) => (
              <circle
                key={seg.name}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                className="transition-all duration-500 hover:opacity-85"
              />
            ))}
          </svg>

          {/* Center Text */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              {typeof totalCount === "number" ||
              (!isNaN(Number(totalCount)) &&
                String(totalCount).trim() !== "") ? (
                <AnimatedNumber value={Number(totalCount)} />
              ) : (
                totalCount
              )}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-wide">
              Total
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex flex-col gap-2 w-full max-w-40">
          {segments.map((seg) => (
            <div
              key={seg.name}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-medium text-slate-600 dark:text-gray-300 truncate">
                  {seg.name}
                </span>
              </div>
              <span className="font-bold text-slate-800 dark:text-gray-200 ml-2">
                {seg.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
