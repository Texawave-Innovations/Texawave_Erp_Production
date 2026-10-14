"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Calendar,
  Clock,
  Menu,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

export interface GlobalHeaderProps {
  onSignOut: () => void;
  onToggleNav?: () => void;
  navOpen?: boolean;
}

function LiveClockBadge() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentDate(dateStr);
      setCurrentTime(timeStr);
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {currentDate && (
        <div className="hidden items-center gap-2 rounded-lg border border-brand-200/60 bg-brand-50/80 px-3 py-1.5 text-theme-xs font-semibold text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/40 dark:text-brand-300 md:flex">
          <Calendar className="h-3.5 w-3.5" />
          <span>{currentDate}</span>
        </div>
      )}

      {currentTime && (
        <div className="hidden items-center gap-2 rounded-lg border border-cyan-200/60 bg-cyan-50/80 px-3 py-1.5 text-theme-xs font-bold font-mono text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300 sm:flex">
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

  const displayName = user?.fullName || "Admin User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-sky-100/80 bg-linear-to-r from-blue-100/50 via-cyan-50/60 to-emerald-50/40 px-4 lg:px-6 dark:border-gray-800 dark:bg-gray-dark dark:bg-none">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-xs">
              {initials}
            </div>

            {/* User Name & Role */}
            <div className="hidden flex-col md:flex">
              <span className="text-theme-xs font-bold leading-tight text-slate-900 dark:text-white/90">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Software Engineer
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
