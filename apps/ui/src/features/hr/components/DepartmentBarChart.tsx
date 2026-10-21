"use client";

import { ChevronDown } from "lucide-react";

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

export interface DepartmentBarChartProps {
  data?: DepartmentData[];
  className?: string;
}

export function DepartmentBarChart({
  data = DEFAULT_DEPARTMENTS,
  className = "",
}: DepartmentBarChartProps) {
  const period = "This Month";
  const highestCount =
    data.length > 0 ? Math.max(...data.map((d) => d.count), 0) : 0;
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
      className={`rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.03)] dark:border-[#1C2029] dark:bg-[#0D1117] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">
          Employee Count by Department
        </h3>

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors dark:border-[#1C2029] dark:bg-[#161B26] dark:text-gray-300"
          >
            <span>{period}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Chart Grid & Bars */}
      {data.length === 0 ? (
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
                <div className="flex-1 border-b border-dashed border-slate-100 dark:border-[#1C2029]" />
              </div>
            ))}
          </div>

          {/* Bars Container */}
          <div className="relative z-10 flex flex-1 items-end justify-between pl-8 pr-2 h-full pb-7">
            {data.map((item) => {
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
                      className="w-full rounded-t-md bg-linear-to-t from-sky-400 via-cyan-400 to-sky-300 shadow-xs transition-all duration-300 group-hover:brightness-105 min-h-1 dark:from-blue-600 dark:via-sky-500 dark:to-cyan-400"
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
  );
}
