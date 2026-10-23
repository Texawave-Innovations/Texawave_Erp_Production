// Feature 3 — CRM Calendar. Read-only calendar over the existing CRM tabs' due-date-like fields
// (meetings, follow-ups, callbacks, Keep in Touch / WhatsApp / LinkedIn reminders). Never moves
// or rewrites any source Firebase data — purely a new visualization of it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday as isTodayFn,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Clock3,
  CalendarClock,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCrmSourceData } from "./useCrmSourceData";
import { buildActivities } from "./unify";
import { EmptyState, SourceTag } from "./components";
import { startOfToday } from "./shared";
import { TAB_META } from "./tabMeta";
import { UnifiedCrmActivity } from "./types";
import { useCrmDomainData } from "../domain/useCrmDomainData";
import { parseLooseDate, extractLooseTime } from "../notifications/dateUtils";

// Matches the fixed card width (`w-56`) + row gap (`gap-2`) below, in px. This app sets a global
// `html { font-size: 14px }` (see index.css), so 1rem = 14px here — NOT the browser default
// 16px — meaning `w-56` (14rem) is 196px and `gap-2` (0.5rem) is 7px, not 224px/8px.
// A row of N cards needs N card-widths plus (N-1) gaps, so the max N that fits a given width is
// floor((width + gap) / (cardWidth + gap)) — not floor(width / (cardWidth + gap)), which
// under-counts by up to one slot since the last card has no trailing gap to pay for.
const AGENDA_CARD_WIDTH_PX = 196;
const AGENDA_GAP_PX = 7;

export type CalendarDomainItemType = "meeting" | "followup" | "task" | "call";

export interface CalendarDomainItem {
  id: string;
  recordId: string;
  itemType: CalendarDomainItemType;
  date: Date;
  title: string;
  subtitle: string;
  tone: "red" | "blue" | "slate";
  accountId: string;
  time?: string;
  assignedTo?: string;
  status?: string;
  extra?: string;
}

type ViewMode = "month" | "week" | "day";

function eventTone(
  a: UnifiedCrmActivity,
): "red" | "blue" | "emerald" | "slate" {
  if (a.isClosedOut) return "emerald";
  if (!a.dueDate) return "slate";
  const today = startOfToday();
  if (a.dueDate < today) return "red";
  if (isTodayFn(a.dueDate)) return "blue";
  return "slate";
}

const DOT_TONE: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
};

const CHIP_TONE: Record<string, string> = {
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function CrmCalendar() {
  const navigate = useNavigate();
  const { sources, loading } = useCrmSourceData();
  const activities = useMemo(() => buildActivities(sources), [sources]);
  const events = useMemo(
    () => activities.filter((a) => !!a.dueDate),
    [activities],
  );

  // CRM Core Domain (Accounts/Pipeline) meetings, follow-ups, calls, and tasks — a separate data
  // source from the 8 sheet tabs above, surfaced here as its own strip rather than merged into the
  // grid (whose rendering is built entirely around `UnifiedCrmActivity`'s shape).
  const {
    accounts,
    meetings,
    followUps,
    tasks,
    activities: crmActivities,
    loading: domainLoading,
  } = useCrmDomainData();
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";
  const domainAgenda = useMemo(() => {
    const today = startOfToday();
    const horizon = addDays(today, 14);
    const items: CalendarDomainItem[] = [];

    meetings.forEach((m) => {
      const d = parseLooseDate(m.date);
      if (!d || m.status === "CANCELLED" || m.status === "COMPLETED") return;
      // Demo-mode meetings get their own label so they read as a distinct calendar category.
      const label = m.mode === "Demo" ? "Demo" : `${m.mode} Meeting`;
      items.push({
        id: `meeting_${m.id}`,
        recordId: m.id,
        itemType: "meeting",
        date: d,
        title: label,
        subtitle: accountName(m.relatedId),
        tone: d < today ? "red" : isSameDay(d, today) ? "blue" : "slate",
        accountId: m.relatedId,
        time: m.startTime,
        status: m.status.replace(/_/g, " "),
        extra: m.participants,
      });
    });
    followUps.forEach((f) => {
      const d = parseLooseDate(f.scheduledAt);
      if (!d || f.status === "COMPLETED" || f.status === "CANCELLED") return;
      items.push({
        id: `followup_${f.id}`,
        recordId: f.id,
        itemType: "followup",
        date: d,
        title: `${f.type} Follow-up`,
        subtitle: accountName(f.relatedId),
        tone: d < today ? "red" : isSameDay(d, today) ? "blue" : "slate",
        accountId: f.relatedId,
        time: extractLooseTime(f.scheduledAt),
        assignedTo: f.assignedTo,
        status: f.status,
      });
    });
    tasks.forEach((t) => {
      const d = parseLooseDate(t.dueDate);
      if (!d || t.status === "Completed") return;
      items.push({
        id: `task_${t.id}`,
        recordId: t.id,
        itemType: "task",
        date: d,
        title: `Task — ${t.title}`,
        subtitle: accountName(t.relatedId),
        tone: d < today ? "red" : isSameDay(d, today) ? "blue" : "slate",
        accountId: t.relatedId,
        time: extractLooseTime(t.dueDate),
        assignedTo: t.assignedTo,
        status: t.status,
      });
    });
    // Calls logged as activities — their own category, distinct from meetings/follow-ups/tasks.
    crmActivities
      .filter((a) => a.type === "Call")
      .forEach((a) => {
        const d = new Date(a.occurredAt);
        if (Number.isNaN(d.getTime())) return;
        items.push({
          id: `call_${a.id}`,
          recordId: a.id,
          itemType: "call",
          date: d,
          title: `Call — ${a.subject}`,
          subtitle: accountName(a.relatedId),
          tone: d < today ? "red" : isSameDay(d, today) ? "blue" : "slate",
          accountId: a.relatedId,
          time: format(d, "hh:mm a"),
          assignedTo: a.createdBy,
        });
      });

    return items
      .filter((i) => i.date <= horizon)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [meetings, followUps, tasks, crmActivities, accounts]);

  // view/cursor/selectedDay are mirrored into the URL query string (see the sync effect below) so
  // this exact calendar state survives navigating to an event's detail page and back — the same
  // "Back to Leads restores the exact list state" fix applied to Leads.tsx, reused here since
  // opening an event detail page is a full route change and would otherwise reset the calendar.
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>(
    () => (searchParams.get("view") as ViewMode) || "month",
  );
  const [cursor, setCursor] = useState<Date>(
    () => parseLooseDate(searchParams.get("cursor")) || startOfToday(),
  );
  const [selectedDay, setSelectedDay] = useState<Date>(
    () => parseLooseDate(searchParams.get("day")) || startOfToday(),
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== "month") params.set("view", view);
    params.set("cursor", format(cursor, "yyyy-MM-dd"));
    params.set("day", format(selectedDay, "yyyy-MM-dd"));
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor, selectedDay]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedCrmActivity[]>();
    events.forEach((e) => {
      const key = format(e.dueDate as Date, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return map;
  }, [events]);

  const eventsFor = (day: Date) =>
    eventsByDay.get(format(day, "yyyy-MM-dd")) || [];

  const goPrev = () =>
    setCursor((c) =>
      view === "month"
        ? addMonths(c, -1)
        : view === "week"
          ? addWeeks(c, -1)
          : addDays(c, -1),
    );
  const goNext = () =>
    setCursor((c) =>
      view === "month"
        ? addMonths(c, 1)
        : view === "week"
          ? addWeeks(c, 1)
          : addDays(c, 1),
    );
  const goToday = () => {
    const t = startOfToday();
    setCursor(t);
    setSelectedDay(t);
  };

  const renderEventChip = (e: UnifiedCrmActivity) => {
    const tone = eventTone(e);
    return (
      <button
        key={e.id}
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          setSelectedDay(e.dueDate as Date);
        }}
        className={cn(
          "block w-full text-left text-xs font-semibold px-1.5 py-0.5 rounded-md border truncate mb-0.5",
          CHIP_TONE[tone],
        )}
        title={`${e.companyName} — ${TAB_META[e.sourceTab].label}`}
      >
        {e.companyName || "Unknown"}
      </button>
    );
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({
      start,
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    });
  }, [cursor]);

  const selectedEvents = eventsFor(selectedDay).sort(
    (a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime(),
  );

  // Tracks the agenda row's own visible width so the "-" filler count is exact — never renders a
  // partial card in either direction, unlike a CSS overflow-clip trick. A callback ref (not
  // useRef + useEffect) is required because this row only mounts once domainLoading flips to
  // false — a plain useEffect([]) would run before the div exists and never observe anything.
  const agendaObserverRef = useRef<ResizeObserver | null>(null);
  const [agendaRowWidth, setAgendaRowWidth] = useState(0);
  const agendaRowRef = useCallback((el: HTMLDivElement | null) => {
    agendaObserverRef.current?.disconnect();
    agendaObserverRef.current = null;
    if (!el) return;
    // `getBoundingClientRect` (not just the ResizeObserver callback) so the very first reading
    // reflects final layout even if ResizeObserver's initial dispatch fires a frame early — and a
    // follow-up rAF re-check catches any late reflow (e.g. web-font swap) the observer might miss
    // because the element's own box size didn't change even though its content did.
    const measure = () => setAgendaRowWidth(el.getBoundingClientRect().width);
    measure();
    requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    agendaObserverRef.current = observer;
  }, []);
  const agendaVisibleSlots = Math.max(
    0,
    Math.floor(
      (agendaRowWidth + AGENDA_GAP_PX) / (AGENDA_CARD_WIDTH_PX + AGENDA_GAP_PX),
    ),
  );
  const agendaPlaceholderCount = Math.max(
    0,
    agendaVisibleSlots - domainAgenda.length,
  );

  return (
    <div className="space-y-6">
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
              Meetings, follow-ups, and reminders from every CRM tab.
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <button
              key={v}
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

      {!domainLoading && domainAgenda.length > 0 && (
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
            >
              {domainAgenda.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate(
                      `/crm/calendar/event/${item.itemType}/${item.recordId}`,
                      {
                        state: {
                          from: `${window.location.pathname}?${searchParams.toString()}`,
                          label: "Calendar",
                        },
                      },
                    )
                  }
                  className={cn(
                    "shrink-0 w-56 text-left rounded-xl border p-2.5 hover:shadow-sm transition-shadow",
                    item.tone === "red"
                      ? "bg-red-50/60 border-red-200"
                      : item.tone === "blue"
                        ? "bg-blue-50/60 border-blue-200"
                        : "bg-slate-50 border-slate-200",
                  )}
                >
                  <p className="text-sm font-bold text-slate-700 truncate">
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                    <Building2 className="h-3 w-3 shrink-0" /> {item.subtitle}
                  </p>
                  {item.extra && (
                    <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" /> {item.extra}
                    </p>
                  )}
                  {item.assignedTo && (
                    <p className="text-sm text-slate-500 truncate mt-0.5 flex items-center gap-1">
                      <UserCheck className="h-3 w-3 shrink-0" />{" "}
                      {item.assignedTo}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <p className="text-sm text-slate-400">
                      {format(item.date, "dd MMM")}
                      {item.time ? ` · ${item.time}` : ""}
                    </p>
                    {item.status && (
                      <span className="text-xs font-semibold text-slate-500 bg-white/70 border border-slate-200 rounded-full px-1.5 py-0.5 shrink-0">
                        {item.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {/* Exact "-" filler count, computed from the row's own measured width — never a
                  partial box in either direction, since we render precisely as many as fit. */}
              {Array.from({ length: agendaPlaceholderCount }).map((_, i) => (
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
              className="h-8 w-8 p-0 rounded-lg"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-bold text-slate-800">
            {view === "day"
              ? format(cursor, "dd MMMM yyyy")
              : view === "week"
                ? `Week of ${format(weekDays[0], "dd MMM")}`
                : format(cursor, "MMMM yyyy")}
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

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Loading CRM data…
          </div>
        ) : view === "month" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-slate-300">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-bold text-slate-400 uppercase py-2 border-l border-slate-300 first:border-l-0"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-slate-300">
              {monthDays.map((day) => {
                const dayEvents = eventsFor(day);
                const isCurrentMonth = isSameMonth(day, cursor);
                const isSelected = isSameDay(day, selectedDay);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[92px] border-b border-r border-slate-300 p-1.5 text-left align-top transition-colors",
                      !isCurrentMonth && "bg-slate-50/50 text-slate-300",
                      isSelected &&
                        "bg-brand-50/60 ring-1 ring-inset ring-brand-300",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold inline-flex h-5 w-5 items-center justify-center rounded-full",
                        isTodayFn(day) && "bg-brand-500 text-white",
                        !isTodayFn(day) && isCurrentMonth && "text-slate-700",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1">
                      {dayEvents.slice(0, 2).map(renderEventChip)}
                      {dayEvents.length > 2 && (
                        <p className="text-sm text-slate-400 pl-1">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : view === "week" ? (
          <div className="divide-y divide-slate-100">
            {weekDays.map((day) => {
              const dayEvents = eventsFor(day).sort(
                (a, b) =>
                  (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime(),
              );
              return (
                <div key={day.toISOString()} className="flex gap-4 p-3">
                  <button
                    onClick={() => setSelectedDay(day)}
                    className="w-24 shrink-0 text-left"
                  >
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isTodayFn(day) ? "text-brand-600" : "text-slate-700",
                      )}
                    >
                      {format(day, "EEE dd MMM")}
                    </p>
                    {isTodayFn(day) && (
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
                          <span
                            key={e.id}
                            className={cn(
                              "text-xs font-medium px-2 py-1 rounded-lg border",
                              CHIP_TONE[eventTone(e)],
                            )}
                          >
                            {e.companyName || "Unknown"} ·{" "}
                            {TAB_META[e.sourceTab].label}
                          </span>
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
                {eventsFor(cursor)
                  .sort(
                    (a, b) =>
                      (a.dueDate as Date).getTime() -
                      (b.dueDate as Date).getTime(),
                  )
                  .map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          DOT_TONE[eventTone(e)],
                        )}
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {e.companyName || "Unknown"}
                      </span>
                      <SourceTag sourceTab={e.sourceTab} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected day detail panel (month/week views) */}
      {view !== "day" && (
        <div className="crm-panel-frame rounded-3xl bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-800">
              {format(selectedDay, "EEEE, dd MMMM yyyy")}
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
                const meta = TAB_META[e.sourceTab];
                return (
                  <div
                    key={e.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {e.companyName || "Unknown Company"}
                        </p>
                      </div>
                      {e.prospectName && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 ml-5">
                          <User className="h-3 w-3" /> {e.prospectName}
                          {e.title ? ` · ${e.title}` : ""}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 ml-5">
                        <SourceTag sourceTab={e.sourceTab} />
                        {e.statusText && (
                          <span className="text-sm text-slate-400">
                            {e.statusText}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs rounded-lg"
                        onClick={() =>
                          navigate(`${meta.route}?row=${e.sourceRowId}`)
                        }
                      >
                        Open in {meta.label}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs rounded-lg"
                        onClick={() => navigate(`/crm/company/${e.companyKey}`)}
                      >
                        Company 360
                      </Button>
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
