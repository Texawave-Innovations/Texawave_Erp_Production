"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Calendar,
  Clock,
  Bell,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export interface GlobalHeaderProps {
  onSignOut: () => void;
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
        <div className="hidden items-center gap-2 rounded-lg bg-indigo-50/70 px-3 py-1.5 text-theme-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 md:flex">
          <Calendar className="h-3.5 w-3.5" />
          <span>{currentDate}</span>
        </div>
      )}

      {currentTime && (
        <div className="hidden items-center gap-2 rounded-lg bg-blue-50/70 px-3 py-1.5 text-theme-xs font-bold font-mono text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 sm:flex">
          <Clock className="h-3.5 w-3.5" />
          <span>{currentTime}</span>
        </div>
      )}
    </>
  );
}

export function GlobalHeader({ onSignOut }: GlobalHeaderProps) {
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 dark:border-gray-800 dark:bg-gray-dark">
      {/* Left: Global Search Input */}
      <div className="flex items-center gap-4">
        <div className="relative w-48 sm:w-64 lg:w-72">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/70 pl-8 pr-3 text-theme-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-800/50 dark:text-white dark:focus:bg-gray-800 transition-colors"
          />
        </div>
      </div>

      {/* Right: Date, Live Clock, Notifications, User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Date & Live Clock Badges (Isolated from root header renders) */}
        <LiveClockBadge />

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* User Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-lg p-1 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800/50 transition-colors"
          >
            {/* Avatar Circle */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shadow-theme-xs">
              {initials}
            </div>

            {/* User Name & Role */}
            <div className="hidden flex-col md:flex">
              <span className="text-theme-xs font-bold leading-tight text-gray-900 dark:text-white/90">
                {displayName}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                Super Admin
              </span>
            </div>

            <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 md:inline-block" />
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
