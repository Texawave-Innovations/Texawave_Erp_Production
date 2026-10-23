"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";

export function NavbarDateTimeCalendar() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle outside click & escape key
  useEffect(() => {
    if (!calendarOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setCalendarOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [calendarOpen]);

  // Formatted date and time
  const formattedDateLong = currentDate.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedDateShort = currentDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });

  const formattedTimeLong = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const formattedTimeShort = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Calendar month calculation
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToToday = () => setViewDate(new Date());

  const days: { day: number; currentMonth: boolean; isToday: boolean }[] = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      currentMonth: false,
      isToday: false,
    });
  }
  // Current month days
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === i;
    days.push({ day: i, currentMonth: true, isToday });
  }
  // Next month padding to fill grid
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, currentMonth: false, isToday: false });
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Current date and time. Click to open calendar"
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        onClick={() => setCalendarOpen((prev) => !prev)}
        className="flex h-9 items-center gap-1.5 sm:gap-2 rounded-xl border border-sky-100/90 bg-white/80 px-2 sm:px-2.5 2xl:px-3 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur-md transition-all hover:border-sky-300 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-sky-900/40 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white cursor-pointer"
      >
        <Calendar className="h-3.5 w-3.5 text-brand-600 dark:text-cyan-400 shrink-0" />
        <span className="hidden 2xl:inline font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
          {formattedDateLong}
        </span>
        <span className="inline 2xl:hidden font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px]">
          {formattedDateShort}
        </span>
        <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
        <Clock className="h-3.5 w-3.5 text-sky-500 dark:text-cyan-300 shrink-0" />
        <span className="hidden 2xl:inline tabular-nums font-semibold text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {formattedTimeLong}
        </span>
        <span className="inline 2xl:hidden tabular-nums font-semibold text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {formattedTimeShort}
        </span>
      </button>

      {/* Interactive Calendar Dropdown Popover */}
      {calendarOpen && (
        <div
          role="dialog"
          aria-label="Interactive Calendar"
          className="glass-calendar-surface absolute right-0 top-full mt-2.5 z-50 w-74 rounded-2xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-sky-100/70 dark:border-slate-800">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-xl border border-sky-100/80 bg-white/60 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-500 dark:text-slate-400 cursor-pointer shadow-2xs transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              {monthName}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-sky-100 dark:bg-slate-800 dark:text-cyan-300 cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-7.5 w-7.5 items-center justify-center rounded-xl border border-sky-100/80 bg-white/60 hover:bg-sky-50 hover:border-sky-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:text-cyan-300 text-slate-500 dark:text-slate-400 cursor-pointer shadow-2xs transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((item, idx) => (
              <span
                key={idx}
                className={`flex h-7.5 w-7.5 items-center justify-center rounded-xl text-xs transition-all ${
                  item.isToday
                    ? "bg-linear-to-r from-brand-600 to-sky-500 text-white font-bold shadow-2xs scale-102"
                    : item.currentMonth
                      ? "text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 font-semibold cursor-default"
                      : "text-slate-300 dark:text-slate-600 cursor-default"
                }`}
              >
                {item.day}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
