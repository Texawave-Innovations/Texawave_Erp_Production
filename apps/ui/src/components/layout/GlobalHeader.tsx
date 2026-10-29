"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Calendar,
  Clock,
  Menu,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useMyDocuments, useMyEmployee } from "@/features/onboarding/hooks";
import { getResolvedAvatarUrl } from "@/features/hr/components/EmployeeIdentity";

export interface GlobalHeaderProps {
  onSignOut: () => void;
  onToggleNav?: () => void;
  navOpen?: boolean;
}

import {
  useRegionalFormatter,
  useUserPreferences,
  useUpdateUserPreferences,
} from "@/features/settings/preferences/hooks";
import {
  applyThemeToDom,
  resolveIsDark,
} from "@/features/settings/preferences/theme-manager";

function ThemeToggle() {
  const { data: prefData } = useUserPreferences();
  const updatePrefMutation = useUpdateUserPreferences();
  const currentTheme = prefData?.effective?.theme ?? "system";
  const isDark = resolveIsDark(currentTheme);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    applyThemeToDom(nextTheme);
    updatePrefMutation.mutate({ theme: nextTheme });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-[#263650] dark:bg-[#1B2940] dark:text-[#9BAEC9] dark:hover:bg-[#263650] dark:hover:text-[#F1F5FC] transition-colors cursor-pointer"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600" />
      )}
    </button>
  );
}

function LiveClockBadge() {
  const { formatDate, formatTime } = useRegionalFormatter();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentDate = formatDate(now);
  const currentTime = formatTime(now);

  return (
    <>
      {currentDate && (
        <div className="hidden items-center gap-2 rounded-lg border border-brand-200/60 bg-brand-50/80 px-3 py-1.5 text-theme-xs font-semibold text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/40 dark:text-brand-300 md:flex">
          <Calendar className="h-3.5 w-3.5" />
          <span>{currentDate}</span>
        </div>
      )}

      {currentTime && (
        <div className="hidden items-center gap-2 rounded-lg border border-cyan-200/60 bg-cyan-50/80 px-3 py-1.5 text-theme-xs font-bold text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300 sm:flex">
          <Clock className="h-3.5 w-3.5" />
          <span>{currentTime}</span>
        </div>
      )}
    </>
  );
}

export function GlobalHeader({
  onSignOut,
  onToggleNav,
  navOpen,
}: GlobalHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const myEmployee = useMyEmployee();
  const myDocuments = useMyDocuments();
  const photoDoc = myDocuments.data?.find(
    (d) => d.documentType === "PROFILE_PHOTO",
  );
  const rawAvatarUrl =
    myEmployee.data?.avatarUrl ||
    (photoDoc ? "/employee/profile/documents/PROFILE_PHOTO/file" : null);
  const resolvedAvatarUrl = getResolvedAvatarUrl(rawAvatarUrl);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const showAvatarImg = Boolean(
    resolvedAvatarUrl && failedAvatarUrl !== resolvedAvatarUrl,
  );

  const displayName =
    user?.fullName || myEmployee.data?.fullName || "Admin User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-sky-100/80 bg-linear-to-r from-blue-100/50 via-cyan-50/60 to-emerald-50/40 px-4 lg:px-6 dark:border-[#1C2029] dark:bg-[#08090D] dark:bg-none">
      {/* Left: Mobile Nav Toggle + Global Search Input */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        {onToggleNav && (
          <button
            type="button"
            onClick={onToggleNav}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="relative w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search anything..."
            aria-label="Search"
            className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-10 pr-4 text-theme-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs dark:border-gray-800 dark:bg-gray-800/80 dark:text-white transition-all"
          />
        </div>
      </div>

      {/* Right: Date, Live Clock, Notifications, User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Date & Live Clock Badges (Isolated from root header renders) */}
        <LiveClockBadge />

        {/* Notification Bell (the caller's in-app inbox) */}
        <NotificationBell />

        {/* Theme Toggle (Light / Dark Mode) */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white/80 p-1.5 pr-2.5 text-left hover:bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-800/60 dark:hover:bg-gray-800 transition-colors"
          >
            {/* Avatar Circle */}
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-sky-200/90 bg-linear-to-br from-[#1769F5] to-cyan-500 text-xs font-bold text-white shadow-xs">
              {showAvatarImg ? (
                <img
                  key={resolvedAvatarUrl}
                  src={resolvedAvatarUrl!}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setFailedAvatarUrl(resolvedAvatarUrl)}
                />
              ) : (
                initials
              )}
            </div>

            {/* User Name & Role */}
            <div className="hidden flex-col md:flex">
              <span className="text-theme-xs font-bold leading-tight text-slate-900 dark:text-white/90">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {myEmployee.data?.designation?.name ||
                  myEmployee.data?.department?.name ||
                  "Administrator"}
              </span>
            </div>

            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:inline-block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                <p className="text-theme-xs font-bold text-gray-900 dark:text-white/90">
                  {displayName}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {user?.email || "admin@texawave.com"}
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-xs font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/40 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
