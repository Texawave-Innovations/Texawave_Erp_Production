"use client";

import Link from "next/link";

export interface EmployeeIdentityProps {
  name: string;
  code?: string | undefined;
  subtext?: string | undefined;
  href?: string | undefined;
  avatarSize?: "sm" | "md" | "lg" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
}

/** Deterministic background color generator based on name initials */
const AVATAR_PALETTES = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index] ?? AVATAR_PALETTES[0]!;
}

/**
 * Reusable Employee Identity component conforming to TEXA HR Design System.
 * Displays avatar initials, full name, and employee code.
 * Intended for reuse across: Employees, Attendance, Leaves, Work Logs,
 * Regularization, Payroll, Tickets, Exit Requests, Org Chart.
 */
export function EmployeeIdentity({
  name,
  code,
  subtext,
  href,
  avatarSize = "md",
  size,
  className = "",
}: EmployeeIdentityProps) {
  const initials = getInitials(name);
  const palette = getPalette(name);
  const effectiveSize = size ?? avatarSize;

  const sizeClasses = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-theme-xs",
    lg: "h-11 w-11 text-theme-sm",
  }[effectiveSize];

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Avatar Circle */}
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border font-bold shadow-theme-xs transition-transform duration-150 ${sizeClasses} ${palette}`}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Identity Text */}
      <div className="min-w-0 flex flex-col">
        {href ? (
          <Link
            href={href}
            className="truncate text-theme-xs font-bold text-gray-900 transition-colors hover:text-brand-700 hover:underline dark:text-white/90 dark:hover:text-brand-400"
          >
            {name}
          </Link>
        ) : (
          <span className="truncate text-theme-xs font-bold text-gray-900 dark:text-white/90">
            {name}
          </span>
        )}

        {code && (
          <span className="truncate font-mono text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {code}
          </span>
        )}

        {subtext && (
          <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );

  return content;
}

export const EmployeeAvatar = EmployeeIdentity;
