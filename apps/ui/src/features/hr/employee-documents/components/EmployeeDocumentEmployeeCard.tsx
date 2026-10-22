"use client";

import Link from "next/link";
import { FolderOpen, ChevronRight, Calendar, Briefcase } from "lucide-react";
import { getInitials, getPalette, getResolvedAvatarUrl } from "@/features/hr/components/EmployeeIdentity";
import type { EmployeeListItem } from "@/features/hr/employees/types";

interface EmployeeDocumentEmployeeCardProps {
  employee: EmployeeListItem;
}

export function EmployeeDocumentEmployeeCard({
  employee,
}: EmployeeDocumentEmployeeCardProps) {
  const initials = getInitials(employee.fullName);
  const palette = getPalette(employee.fullName);
  const isActive = employee.status === "ACTIVE";
  const resolvedUrl = getResolvedAvatarUrl(employee.avatarUrl);

  const formattedDate = employee.dateOfJoining
    ? new Date(employee.dateOfJoining).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700">
      {/* Top Header: Avatar + Status Dot + Code Badge */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {/* Avatar with Status Dot */}
          <div className="relative shrink-0">
            <div
              className={`flex h-13 w-13 items-center justify-center overflow-hidden rounded-2xl border text-base font-bold shadow-xs transition-transform duration-150 group-hover:scale-105 ${palette}`}
              aria-hidden="true"
            >
              {resolvedUrl ? (
                <img
                  src={resolvedUrl}
                  alt={employee.fullName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                initials
              )}
            </div>
            {/* Status indicator dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ring-black/5 dark:border-slate-900 ${
                isActive ? "bg-emerald-500" : "bg-slate-400"
              }`}
              title={`Status: ${employee.status}`}
            />
          </div>

          {/* Employee Code Badge */}
          <span className="rounded-md border border-sky-200/80 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-[#0284c7] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            {employee.employeeCode}
          </span>
        </div>

        {/* Name & Designation */}
        <div className="mt-3.5 min-w-0">
          <Link
            href={`/hr/employee-documents/${employee.id}`}
            className="block truncate text-base font-bold text-slate-900 transition-colors hover:text-brand-500 dark:text-white dark:hover:text-[#38bdf8]"
            title={employee.fullName}
          >
            {employee.fullName}
          </Link>
          <p
            className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400"
            title={employee.designation?.name || "No designation"}
          >
            {employee.designation?.name || "—"}
          </p>
        </div>

        {/* Department / Team Row */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-800/40">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            Department
          </span>
          <span
            className="max-w-35 truncate rounded-lg border border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0a3271] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
            title={employee.team?.name || "Unassigned"}
          >
            {employee.team?.name || "—"}
          </span>
        </div>

        {/* Metadata: Employment Type & Date */}
        <div className="mt-3 space-y-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
          {employee.employmentType?.name && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{employee.employmentType.name}</span>
            </div>
          )}
          {formattedDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Joined {formattedDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Link
          href={`/hr/employee-documents/${employee.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#1769F5] to-[#0284c7] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:from-[#1357ca] hover:to-[#0270a8] hover:shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <FolderOpen className="h-4 w-4" />
          <span>View Documents</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-80" />
        </Link>
      </div>
    </div>
  );
}
