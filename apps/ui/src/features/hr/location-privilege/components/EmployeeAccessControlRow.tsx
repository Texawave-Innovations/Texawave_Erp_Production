"use client";

import { Building2, Loader2, Wifi } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import { cn, useToast } from "@texawave-erp/ui-kit";
import {
  useEmployeeLocationPrivilege,
  useSetEmployeeLocationPrivilege,
} from "../hooks";
import type { LocationMode } from "../types";
import type { EmployeeListItem } from "../../employees/types";

export interface EmployeeAccessControlRowProps {
  employee: EmployeeListItem;
  canWrite: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function EmployeeAccessControlRow({
  employee,
  canWrite,
}: EmployeeAccessControlRowProps) {
  const { toast } = useToast();
  const privilegeQuery = useEmployeeLocationPrivilege(employee.id);
  const setMutation = useSetEmployeeLocationPrivilege();

  const currentMode = privilegeQuery.data?.mode ?? null;
  const isUpdating = setMutation.isPending;

  async function handleToggle(mode: LocationMode) {
    if (!canWrite || isUpdating) return;
    if (currentMode === mode) return;

    try {
      await setMutation.mutateAsync({
        employeeId: employee.id,
        mode,
      });
      toast({
        title: `Updated ${employee.fullName} to ${mode === "OFFICE" ? "Office" : "Remote"} access`,
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiError && error.isPermissionError) {
        toast({
          title: "You cannot change your own location privilege",
          variant: "error",
        });
      } else {
        toast({
          title: "Could not update location privilege",
          variant: "error",
        });
      }
    }
  }

  const subtext = [
    employee.employeeCode,
    employee.team?.name,
    employee.designation?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl border border-gray-100 bg-white/95 dark:border-gray-800/80 dark:bg-gray-900/80 hover:bg-sky-50/30 dark:hover:bg-slate-800/40 transition-all">
      {/* Left: Avatar & Identity */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-100 to-sky-200 text-sm font-bold text-[#0a3271] dark:from-sky-950 dark:to-slate-800 dark:text-sky-300 shadow-2xs">
          {getInitials(employee.fullName)}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="font-bold text-gray-900 dark:text-white text-theme-sm truncate">
            {employee.fullName}
          </span>
          <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400 truncate">
            {subtext || employee.employeeCode}
          </span>
        </div>
      </div>

      {/* Right: Segmented Toggle Switch & Status Pill */}
      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
        {/* Interactive Segmented Control */}
        <div className="inline-flex items-center rounded-xl border border-gray-200/90 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/80">
          {/* Office Button */}
          <button
            type="button"
            disabled={!canWrite || isUpdating}
            onClick={() => handleToggle("OFFICE")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              "focus-visible:outline-2 focus-visible:outline-brand-500",
              currentMode === "OFFICE"
                ? "bg-brand-500 text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/80 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700/60",
              (!canWrite || isUpdating) && "opacity-70 cursor-not-allowed",
            )}
            title="Office access only (Network required)"
          >
            {isUpdating && currentMode !== "OFFICE" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Building2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>Office</span>
          </button>

          {/* Remote Button */}
          <button
            type="button"
            disabled={!canWrite || isUpdating}
            onClick={() => handleToggle("REMOTE")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              "focus-visible:outline-2 focus-visible:outline-emerald-500",
              currentMode === "REMOTE"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/80 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700/60",
              (!canWrite || isUpdating) && "opacity-70 cursor-not-allowed",
            )}
            title="Remote access (No network check)"
          >
            {isUpdating && currentMode !== "REMOTE" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wifi className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>Remote</span>
          </button>
        </div>

        {/* State Tag Pill */}
        <div className="w-26 text-right">
          {currentMode === "OFFICE" && (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 border border-sky-200/80 dark:bg-sky-950/60 dark:border-sky-900/50 dark:text-sky-300">
              Desktop only
            </span>
          )}
          {currentMode === "REMOTE" && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:border-emerald-900/50 dark:text-emerald-300">
              Mobile allowed
            </span>
          )}
          {!currentMode && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Unrestricted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
