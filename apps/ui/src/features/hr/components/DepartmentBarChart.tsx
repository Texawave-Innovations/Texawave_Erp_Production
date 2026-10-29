"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DepartmentData {
  name: string;
  count: number;
}

const DEFAULT_DEPARTMENTS: DepartmentData[] = [
  { name: "Admin", count: 120 },
  { name: "Production", count: 160 },
  { name: "Marketing", count: 90 },
  { name: "Sales", count: 170 },
  { name: "Finance", count: 110 },
  { name: "HR", count: 150 },
  { name: "IT", count: 100 },
];

export const PERIOD_OPTIONS = [
  "This Month",
  "3 Months",
  "6 Months",
  "1 Year",
] as const;
export type ChartPeriod = (typeof PERIOD_OPTIONS)[number];

const PERIOD_MULTIPLIERS: Record<ChartPeriod, number> = {
  "This Month": 1,
  "3 Months": 2.8,
  "6 Months": 5.4,
  "1 Year": 10.5,
};

export interface DepartmentBarChartProps {
  data?: DepartmentData[];
  className?: string;
}

export function DepartmentBarChart({
  data = DEFAULT_DEPARTMENTS,
  className = "",
}: DepartmentBarChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("This Month");
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

  // Dynamically calculate adjusted data based on selected filter period
  const adjustedData = useMemo(() => {
    const multiplier = PERIOD_MULTIPLIERS[period];
    return data.map((d) => ({
      name: d.name,
      count: Math.round(d.count * multiplier),
    }));
  }, [data, period]);

  const highestCount =
    adjustedData.length > 0
      ? Math.max(...adjustedData.map((d) => d.count), 0)
      : 0;
  const maxVal =
    highestCount === 0
      ? 10
      : highestCount <= 5
        ? 5
        : highestCount <= 10
          ? 10
          : highestCount <= 25
            ? 25
            : highestCount <= 50
              ? 50
              : Math.ceil(highestCount / 25) * 25;

  const step = maxVal / 4;
  const gridSteps = [
    maxVal,
    Math.round(step * 3),
    Math.round(step * 2),
    Math.round(step),
    0,
  ];

  return (
    <div
      className={`rounded-2xl border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.03)] dark:border-[#1C2029] dark:bg-[#0D1117] ${className}`}
    >
      {/* Light Sky & Cloud Tinted Header Bar */}
      <div className="flex items-center justify-between border-b border-sky-200/70 bg-linear-to-r from-sky-50/90 via-[#f0f8ff] to-sky-50/60 px-5 py-3.5 dark:border-sky-900/60 dark:from-sky-950/40 dark:via-gray-900 dark:to-sky-950/20">
        <h3 className="text-sm font-bold text-[#0a3271] dark:text-sky-100">
          Employee Count by Department
        </h3>

        {/* Interactive Period Filter Dropdown */}
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
              {PERIOD_OPTIONS.map((opt) => {
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
        {/* Chart Grid & Bars */}
        {adjustedData.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center text-center px-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
              No department data available
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
              Departments and workforce counts will appear here once added.
            </p>
          </div>
        ) : (
          <div className="relative flex h-52 items-end pt-6">
            {/* Y-Axis Grid Lines & Labels */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-7">
              {gridSteps.map((stepVal) => (
                <div key={stepVal} className="flex items-center gap-2 w-full">
                  <span className="w-6 text-[10px] font-medium text-slate-400 dark:text-gray-500 text-right shrink-0">
                    {stepVal}
                  </span>
                  <div className="flex-1 border-b border-dashed border-slate-100 dark:border-gray-800/80" />
                </div>
              ))}
            </div>

            {/* Bars Container */}
            <div className="relative z-10 flex flex-1 items-end justify-between pl-8 pr-2 h-full pb-7">
              {adjustedData.map((item) => {
                const barHeightPct =
                  maxVal > 0
                    ? Math.min(100, Math.round((item.count / maxVal) * 100))
                    : 0;

                return (
                  <div
                    key={item.name}
                    className="group flex flex-col items-center h-full justify-end flex-1 max-w-12"
                  >
                    {/* Number Above Bar */}
                    <span className="text-[11px] font-bold text-slate-800 dark:text-gray-200 mb-1 transition-transform group-hover:-translate-y-0.5">
                      {item.count}
                    </span>

                    {/* The Bar */}
                    <div className="w-full flex-1 flex items-end">
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className="w-full rounded-t-md bg-linear-to-t from-sky-400 via-cyan-400 to-sky-300 shadow-xs transition-all duration-300 group-hover:brightness-105 min-h-1"
                      />
                    </div>

                    {/* Department Label Below */}
                    <span
                      className="absolute bottom-0 text-[10px] font-semibold text-slate-500 dark:text-gray-400 truncate max-w-13 text-center"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
