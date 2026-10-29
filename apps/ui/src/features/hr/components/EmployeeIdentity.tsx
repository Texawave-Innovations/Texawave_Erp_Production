"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

export interface EmployeeIdentityProps {
  name: string;
  code?: string | undefined;
  subtext?: string | undefined;
  href?: string | undefined;
  avatarUrl?: string | null | undefined;
  avatarSize?: "sm" | "md" | "lg" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
}

/** Resolves an avatar image path into an authenticated streaming URL */
export function getResolvedAvatarUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const separator = path.includes("?") ? "&" : "?";
  return token
    ? `${baseUrl}${path}${separator}token=${token}&inline=true`
    : `${baseUrl}${path}`;
}

/** Deterministic background color generator based on name initials */
const AVATAR_PALETTES = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index] ?? AVATAR_PALETTES[0]!;
}

/**
 * Reusable Employee Identity component conforming to TEXA HR Design System.
 * Displays avatar initials or photo, full name, and employee code.
 * Intended for reuse across: Employees, Attendance, Leaves,
 * Regularization, Payroll, Tickets, Exit Requests, Org Chart.
 */
export function EmployeeIdentity({
  name,
  code,
  subtext,
  href,
  avatarUrl,
  avatarSize = "md",
  size,
  className = "",
}: EmployeeIdentityProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = getInitials(name);
  const palette = getPalette(name);
  const effectiveSize = size ?? avatarSize;
  const resolvedUrl = getResolvedAvatarUrl(avatarUrl);
  const showImg = Boolean(resolvedUrl && failedUrl !== resolvedUrl);

  const sizeClasses = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-theme-xs",
    lg: "h-11 w-11 text-theme-sm",
  }[effectiveSize];

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Avatar Circle / Photo */}
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-bold shadow-theme-xs transition-transform duration-150 ${sizeClasses} ${palette}`}
        aria-hidden="true"
      >
        {showImg ? (
          <img
            key={resolvedUrl}
            src={resolvedUrl!}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(resolvedUrl)}
          />
        ) : (
          initials
        )}
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
          <span className="truncate text-[11px] text-gray-500 dark:text-gray-400 font-medium">
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
