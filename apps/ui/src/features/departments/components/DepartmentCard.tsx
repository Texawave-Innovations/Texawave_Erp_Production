"use client";

import type { Department } from "@texawave-erp/api-types";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import {
  formatDepartmentDate,
  getDepartmentCode,
  getDepartmentVisual,
} from "../utils";

interface DepartmentCardProps {
  department: Department;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
}

export function DepartmentCard({
  department,
  onEdit,
  onDelete,
}: DepartmentCardProps) {
  const visual = getDepartmentVisual(department.name);
  const Icon = visual.icon;
  const code = getDepartmentCode(department.name, department.customFields);
  const formattedDate = formatDepartmentDate(department.createdAt);

  return (
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700">
      {/* Top Section */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {/* Visual Icon Box */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border font-bold shadow-2xs transition-transform duration-150 group-hover:scale-105 ${visual.bgColor} ${visual.textColor} ${visual.borderColor}`}
            aria-hidden="true"
          >
            <Icon className="h-6 w-6" />
          </div>

          {/* Right Badges: Code & Status */}
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-md border border-sky-200/80 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-[#0284c7] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              #{code}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                department.isActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}
            >
              {department.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Department Name */}
        <div className="mt-4 min-w-0">
          <h3
            className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-brand-500 dark:text-white dark:group-hover:text-[#38bdf8]"
            title={department.name}
          >
            {department.name}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Created {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
        <Button
          type="button"
          size="sm"
          onClick={() => onEdit(department)}
          className="h-8.5 gap-1.5 rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 text-xs font-bold text-[#0284c7] shadow-2xs hover:bg-sky-100 hover:border-sky-300 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60 cursor-pointer transition-all"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>Edit</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onDelete(department)}
          className="h-8.5 gap-1.5 rounded-xl border border-rose-200/90 bg-rose-50/90 px-3 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-100 hover:border-rose-300 dark:border-rose-800/80 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 cursor-pointer transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </Button>
      </div>
    </div>
  );
}
