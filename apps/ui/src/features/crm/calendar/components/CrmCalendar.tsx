"use client";

// Port of legacy `intelligence/CrmCalendar.tsx` (design, layout and feature set). Legacy rendered it
// as an inline panel of the dashboard; here it lives at /crm/calendar with the same visual design.
import type { CrmCalendarEvent } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  User,
  UserCheck,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import {
  BackToDashboardPanelButton,
  EmptyState,
} from "@/features/crm/dashboard/components/intelligence-ui";
import { useCalendarEvents } from "../hooks";
import {
  addDays,
  addMonths,
  dayKey,
  eachDay,
  endOfWeek,
  eventDate,
  eventDay,
  eventTime,
  eventTone,
  isSameDay,
  parseDayKey,
  startOfToday,
  startOfWeek,
  viewRange,
  type CalendarView,
  type EventTone,
} from "../date-utils";

/** Fixed card width (`w-56`) + row gap (`gap-2`) in px — drives the exact
 * "-" filler count in the agenda strip, as in legacy. */
const AGENDA_CARD_WIDTH_PX = 224;
const AGENDA_GAP_PX = 8;
const AGENDA_HORIZON_DAYS = 14;
const VIEWS: readonly CalendarView[] = ["month", "week", "day"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT_TONE: Record<EventTone, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  slate: "bg-slate-400",
};

const CHIP_TONE: Record<EventTone, string> = {
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDay(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("en-GB", opts);
}

function isView(v: string | null): v is CalendarView {
  return v === "month" || v === "week" || v === "day";
}

/** Legacy `SourceTag`: the item type stands in for the legacy source tab. */
function TypeTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <CalendarClock className="h-3 w-3" /> {label}
    </span>
  );
}

export function CrmCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // view/cursor/day are mirrored into the URL so the exact calendar state
  // survives opening an event and coming back (legacy behaviour).
  const [view, setView] = useState<CalendarView>(() => {
    const v = searchParams.get("view");
    return isView(v) ? v : "month";
  });
  const [cursor, setCursor] = useState<Date>(
    () => parseDayKey(searchParams.get("cursor")) ?? startOfToday(),
  );
  const [selectedDay, setSelectedDay] = useState<Date>(
    () => parseDayKey(searchParams.get("day")) ?? startOfToday(),
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== "month") params.set("view", view);
    params.set("cursor", dayKey(cursor));
    params.set("day", dayKey(selectedDay));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [view, cursor, selectedDay, pathname, router]);

  const today = startOfToday();
  const todayKey = dayKey(today);

  const range = useMemo(() => viewRange(view, cursor), [view, cursor]);
  const gridQuery = useCalendarEvents({
    from: dayKey(range.start),
    to: dayKey(range.end),
  });
  const agendaQuery = useCalendarEvents({
    to: dayKey(addDays(today, AGENDA_HORIZON_DAYS)),
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CrmCalendarEvent[]>();
    for (const e of gridQuery.data?.events ?? []) {
      const key = eventDay(e);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [gridQuery.data]);
  const eventsFor = (d: Date) => eventsByDay.get(dayKey(d)) ?? [];

  const monthDays = useMemo(
    () => eachDay(range.start, range.end),
    [range.start, range.end],
  );
  const weekDays = useMemo(
    () => eachDay(startOfWeek(cursor), endOfWeek(cursor)),
    [cursor],
  );

  const goPrev = () =>
    setCursor((c) =>
      view === "month"
        ? addMonths(c, -1)
        : addDays(c, view === "week" ? -7 : -1),
    );
  const goNext = () =>
    setCursor((c) =>
      view === "month" ? addMonths(c, 1) : addDays(c, view === "week" ? 7 : 1),
    );
  const goToday = () => {
    setCursor(today);
    setSelectedDay(today);
  };

  const returnTo = `${pathname}?${searchParams.toString()}`;
  const openEvent = (e: CrmCalendarEvent) =>
    router.push(
      `/crm/calendar/event/${e.itemType}/${e.recordId}?from=${encodeURIComponent(returnTo)}`,
    );

  // Agenda strip: callback ref (not useRef+useEffect) because the row only
  // mounts once the agenda data has loaded.
  const observerRef = useRef<ResizeObserver | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const agendaRowRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const measure = () => setRowWidth(el.getBoundingClientRect().width);
    measure();
    requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  const agenda = (agendaQuery.data?.events ?? []).slice(0, 20);
  const visibleSlots = Math.max(
    0,
    Math.floor(
      (rowWidth + AGENDA_GAP_PX) / (AGENDA_CARD_WIDTH_PX + AGENDA_GAP_PX),
    ),
  );
  const placeholders = Math.max(0, visibleSlots - agenda.length);

  const selectedEvents = eventsFor(selectedDay);

  const renderChip = (e: CrmCalendarEvent) => (
    <button
      key={e.id}
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        setSelectedDay(eventDate(e));
      }}
      title={`${e.title} — ${e.subtitle}`}
      className={cn(
        "block w-full text-left text-xs font-semibold px-1.5 py-0.5 rounded-md border truncate mb-0.5",
        CHIP_TONE[eventTone(e, todayKey)],
      )}
    >
      {e.subtitle || e.title}
    </button>
  );

  const permissionError =
    gridQuery.error instanceof ApiError && gridQuery.error.isPermissionError;

  return (
    <div className="space-y-6">
      <BackToDashboardPanelButton />

      <div className="crm-panel-frame crm-panel-header relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="p-2.5 bg-gradient-to-br from-brand-400 to-brand-600 text-white rounded-2xl shadow-md shadow-brand-500/20">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              CRM Calendar
            </h2>
            <p className="text-sm text-slate-500">
              Meetings, follow-ups, tasks and calls across every account.
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-xl border capitalize transition-colors",
                view === v
                  ? "bg-brand-50 text-brand-700 border-brand-200"
                  : "text-slate-500 border-transparent hover:bg-slate-100",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {agendaQuery.isSuccess && agenda.length > 0 && (
        <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Accounts &amp; Pipeline — next 14 days
            </h3>
          </div>
          <div className="p-3">
            <div
              ref={agendaRowRef}
              className="crm-calendar-agenda-scroll flex gap-2 overflow-x-auto pb-2 scroll-smooth"
              data-testid="calendar-agenda"
            >
              {agenda.map((e) => {
                const d = eventDate(e);
                const time = eventTime(e);
                const tone = eventTone(e, todayKey);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openEvent(e)}
                    className={cn(
                      "shrink-0 w-56 text-left rounded-xl border p-2.5 hover:shadow-sm transition-shadow",
                      tone === "red"
                        ? "bg-red-50/60 border-red-200"
                        : tone === "blue"
                          ? "bg-blue-50/60 border-blue-200"
                          : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {e.title}
                    </p>
                    <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" /> {e.subtitle}
                    </p>
                    {e.extra && (
                      <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" /> {e.extra}
                      </p>
                    )}
                    {e.assignedTo && (
                      <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 shrink-0" />{" "}
                        {e.assignedTo}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-sm text-slate-400">
                        {formatDay(d, { day: "2-digit", month: "short" })}
                        {time ? ` · ${time}` : ""}
                      </p>
                      {e.status && (
                        <span className="text-xs font-semibold text-slate-500 bg-white/70 border border-slate-200 rounded-full px-1.5 py-0.5 shrink-0">
                          {e.status}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {/* Exact "-" filler count from the row's measured width — never a partial card. */}
              {Array.from({ length: placeholders }, (_, i) => (
                <div
                  key={`agenda-placeholder-${i}`}
                  aria-hidden
                  className="shrink-0 w-56 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 text-slate-400 font-bold text-lg select-none"
                >
                  -
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              aria-label="Previous"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 rounded-lg text-xs"
              onClick={goToday}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label="Next"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-bold text-slate-800">
            {view === "day"
              ? formatDay(cursor, {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : view === "week"
                ? `Week of ${formatDay(weekDays[0] as Date, { day: "2-digit", month: "short" })}`
                : formatDay(cursor, { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Overdue
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Today
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Upcoming
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
            </span>
          </div>
        </div>

        {gridQuery.isPending ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Loading CRM data…
          </div>
        ) : gridQuery.isError ? (
          <div className="p-4">
            {permissionError ? (
              <EmptyState
                icon={CalendarDays}
                title="You don't have access to the calendar"
                description="Ask an administrator for the crm.calendar.read permission."
              />
            ) : (
              <div className="text-center">
                <EmptyState icon={CalendarDays} title="Could not load events" />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void gridQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        ) : view === "month" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-slate-300">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-bold text-slate-400 uppercase py-2 border-l border-slate-300 first:border-l-0"
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              className="grid grid-cols-7 border-l border-slate-300"
              data-testid="calendar-month-grid"
            >
              {monthDays.map((day) => {
                const dayEvents = eventsFor(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={dayKey(day)}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(day)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ")
                        setSelectedDay(day);
                    }}
                    className={cn(
                      "min-h-[92px] border-b border-r border-slate-300 p-1.5 text-left align-top transition-colors cursor-pointer",
                      !inMonth && "bg-slate-50/50 text-slate-300",
                      isSameDay(day, selectedDay) &&
                        "bg-brand-50/60 ring-1 ring-inset ring-brand-300",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold inline-flex h-5 w-5 items-center justify-center rounded-full",
                        isToday && "bg-brand-500 text-white",
                        !isToday && inMonth && "text-slate-700",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-1">
                      {dayEvents.slice(0, 2).map(renderChip)}
                      {dayEvents.length > 2 && (
                        <p className="text-sm text-slate-400 pl-1">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "week" ? (
          <div className="divide-y divide-slate-100">
            {weekDays.map((day) => {
              const dayEvents = eventsFor(day);
              const isToday = isSameDay(day, today);
              return (
                <div key={dayKey(day)} className="flex gap-4 p-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className="w-24 shrink-0 text-left"
                  >
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isToday ? "text-brand-600" : "text-slate-700",
                      )}
                    >
                      {formatDay(day, {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                    {isToday && (
                      <span className="text-xs font-bold text-brand-600">
                        TODAY
                      </span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    {dayEvents.length === 0 ? (
                      <p className="text-sm text-slate-300">No activity</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {dayEvents.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => openEvent(e)}
                            className={cn(
                              "text-xs font-medium px-2 py-1 rounded-lg border",
                              CHIP_TONE[eventTone(e, todayKey)],
                            )}
                          >
                            {e.subtitle || "Unknown"} · {e.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4">
            {eventsFor(cursor).length === 0 ? (
              <EmptyState icon={CalendarDays} title="No activity on this day" />
            ) : (
              <div className="space-y-2">
                {eventsFor(cursor).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openEvent(e)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        DOT_TONE[eventTone(e, todayKey)],
                      )}
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      {e.subtitle || "Unknown"}
                    </span>
                    <TypeTag label={e.title} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected day detail panel (month/week views) */}
      {view !== "day" && gridQuery.isSuccess && (
        <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-800">
              {formatDay(selectedDay, {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-slate-500">
              {selectedEvents.length}{" "}
              {selectedEvents.length === 1 ? "activity" : "activities"}
            </p>
          </div>
          {selectedEvents.length === 0 ? (
            <EmptyState icon={Clock3} title="Nothing scheduled" />
          ) : (
            <div className="divide-y divide-slate-100">
              {selectedEvents.map((e) => {
                const time = eventTime(e);
                return (
                  <div
                    key={e.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {e.subtitle || "Unknown Account"}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 ml-5">
                        <User className="h-3 w-3" /> {e.title}
                        {time ? ` · ${time}` : ""}
                        {e.assignedTo ? ` · ${e.assignedTo}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 ml-5">
                        <TypeTag label={e.relatedType || e.itemType} />
                        {e.status && (
                          <span className="text-sm text-slate-400">
                            {e.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs rounded-lg"
                        onClick={() => openEvent(e)}
                      >
                        View details
                      </Button>
                      {e.accountId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-xs rounded-lg"
                          onClick={() =>
                            router.push(`/crm/accounts/${e.accountId}`)
                          }
                        >
                          Account
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
