"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AnimatedNumber } from "@texawave-erp/ui-kit";

export interface DistributionSegment {
  name: string;
  percentage: number;
  color: string;
}

const DEFAULT_SEGMENTS: DistributionSegment[] = [
  { name: "Production", percentage: 28, color: "#38bdf8" }, // cyan
  { name: "Sales", percentage: 22, color: "#2dd4bf" }, // teal
  { name: "Finance", percentage: 14, color: "#f59e0b" }, // amber
  { name: "Marketing", percentage: 16, color: "#0ea5e9" }, // sky
  { name: "HR", percentage: 10, color: "#2563eb" }, // blue
  { name: "Others", percentage: 10, color: "#64748b" }, // slate
];

export const DONUT_PERIOD_OPTIONS = [
  "This Month",
  "3 Months",
  "6 Months",
  "1 Year",
] as const;
export type DonutPeriod = (typeof DONUT_PERIOD_OPTIONS)[number];

const DONUT_PERIOD_MULTIPLIERS: Record<DonutPeriod, number> = {
  "This Month": 1,
  "3 Months": 1.15,
  "6 Months": 1.35,
  "1 Year": 1.7,
};

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
  const [period, setPeriod] = useState<DonutPeriod>("This Month");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute scaled total count based on period
  const numericBaseCount =
    typeof totalCount === "number"
      ? totalCount
      : !isNaN(Number(String(totalCount).replace(/,/g, "")))
        ? Number(String(totalCount).replace(/,/g, ""))
        : 1248;

  const currentCount = Math.round(
    numericBaseCount * DONUT_PERIOD_MULTIPLIERS[period],
  );

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
      className={`rounded-2xl border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.03)] dark:border-[#1C2029] dark:bg-[#0D1117] ${className}`}
    >
      {/* Light Sky & Cloud Tinted Header Bar */}
      <div className="flex items-center justify-between border-b border-sky-200/70 bg-linear-to-r from-sky-50/90 via-[#f0f8ff] to-sky-50/60 px-5 py-3.5 dark:border-sky-900/60 dark:from-sky-950/40 dark:via-gray-900 dark:to-sky-950/20">
        <h3 className="text-sm font-bold text-[#0a3271] dark:text-sky-100">
          Employee Distribution
        </h3>

        {/* Interactive Filter Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors dark:border-[#1C2029] dark:bg-[#161B26] dark:text-gray-300"
          >
            <span>{period}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-brand-600 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              className="absolute right-0 top-full mt-1.5 z-30 min-w-32 rounded-xl border border-sky-100/90 bg-white/95 p-1 backdrop-blur-md shadow-lg dark:border-gray-700 dark:bg-gray-800 animate-in fade-in zoom-in-95 duration-100"
            >
              {DONUT_PERIOD_OPTIONS.map((opt) => {
                const isSelected = opt === period;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setPeriod(opt);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-sky-500/15 text-brand-700 font-bold dark:bg-sky-400/20 dark:text-cyan-300"
                        : "text-slate-600 hover:bg-sky-50 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check className="h-3 w-3 text-brand-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Donut and Legend row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2 pb-1">
          {/* SVG Donut */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg
              className="h-40 w-40 -rotate-90 transform"
              viewBox="0 0 140 140"
            >
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
                <AnimatedNumber value={currentCount} />
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
    </div>
  );
}
