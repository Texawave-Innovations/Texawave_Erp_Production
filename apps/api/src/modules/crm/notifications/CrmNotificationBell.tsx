// CRM-only notification bell. Rendered exclusively inside CRMLayout.tsx, so it is only ever
// visible under `/crm/*`. Reads/writes exclusively `crm/notifications/feed` — never touches the
// app's global notification bell/path (components/NotificationBell.tsx, `notifications/*`).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  Calendar,
  Check,
  Clock3,
  AlarmClockOff,
  CalendarClock,
  PhoneCall,
  MessageCircle,
  MessageSquare,
  Linkedin,
  Handshake,
  Briefcase,
  Receipt,
  Trash2,
  RotateCcw,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "../intelligence/components";
import { DateTimePicker } from "../components/DateTimePicker";
import { isCrmAdmin } from "../domain/roles";
import {
  acknowledgeCrmNotification,
  deleteCrmNotification,
  markCrmNotificationDone,
  markCrmNotificationRead,
  permanentlyDeleteCrmNotification,
  restoreCrmNotification,
  snoozeCrmNotification,
  subscribeToCrmRecycleBin,
} from "./crmNotificationService";
import { useCrmNotificationFeed } from "./notificationFeedContext";
import {
  CrmDeletedNotification,
  CrmNotification,
  CrmNotificationRecycleBin,
  CrmNotificationSourceTab,
} from "./types";
import {
  Group,
  groupFor,
  GROUP_ORDER,
  GROUP_STYLE,
  SOURCE_ROUTES,
  snoozePresets,
} from "./notificationGrouping";

const SOURCE_ICON: Record<CrmNotificationSourceTab, LucideIcon> = {
  yetToHappen: CalendarClock,
  leads: Handshake,
  callBackSendInfo: PhoneCall,
  keepInTouch: MessageCircle,
  whatsapp: MessageSquare,
  linkedin: Linkedin,
  domainMeetings: CalendarClock,
  domainFollowUps: Clock3,
  domainOpportunities: Briefcase,
  domainQuotations: Receipt,
};

const STATUS_STYLE: Record<CrmNotification["status"], string> = {
  Pending: "bg-slate-100 text-slate-600",
  Acknowledged: "bg-blue-100 text-blue-700",
  Done: "bg-emerald-100 text-emerald-700",
  Snoozed: "bg-purple-100 text-purple-700",
  Overdue: "bg-red-100 text-red-700",
};

const PRIORITY_DOT: Record<CrmNotification["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

type ViewMode = "active" | "completed" | "recycle";

export function CrmNotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feed = useCrmNotificationFeed();
  const [recycleBin, setRecycleBin] = useState<CrmNotificationRecycleBin>({});
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [snoozeOpenFor, setSnoozeOpenFor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToCrmRecycleBin(setRecycleBin), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPopup = popupRef.current?.contains(target);
      if (!inContainer && !inPopup) {
        setOpen(false);
        setSnoozeOpenFor(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const all = useMemo(
    () =>
      Object.values(feed).sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return b.createdAt - a.createdAt;
      }),
    [feed],
  );

  const active = all.filter((n) => n.status !== "Done");
  const done = all.filter((n) => n.status === "Done");

  // The bell badge reflects new/unread notifications specifically (not just Pending/Overdue
  // status), so it lights up red for anything the user hasn't opened yet.
  const attentionCount = active.filter((n) => !n.isRead).length;
  const overdueCount = active.filter((n) => groupFor(n) === "Overdue").length;
  const todayCount = active.filter((n) => groupFor(n) === "Today").length;
  const tomorrowCount = active.filter((n) => groupFor(n) === "Tomorrow").length;

  const grouped = useMemo(() => {
    const map: Record<Group, CrmNotification[]> = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      Snoozed: [],
      Upcoming: [],
    };
    active.forEach((n) => map[groupFor(n)].push(n));
    return map;
  }, [active]);

  const recycled = useMemo(
    () => Object.values(recycleBin).sort((a, b) => b.deletedAt - a.deletedAt),
    [recycleBin],
  );

  const deletedBy = user?.name || user?.username || "CRM User";

  const handleAcknowledge = (id: string) =>
    acknowledgeCrmNotification(id).catch((e) => console.error(e));
  const handleDone = (id: string) => {
    setSnoozeOpenFor(null);
    markCrmNotificationDone(id).catch((e) => console.error(e));
  };
  const handleSnooze = (id: string, until: number) => {
    setSnoozeOpenFor(null);
    snoozeCrmNotification(id, until).catch((e) => console.error(e));
  };
  const handleDelete = (n: CrmNotification) =>
    deleteCrmNotification(n, deletedBy).catch((e) => {
      console.error(e);
      toast.error("Failed to delete notification", {
        description: e instanceof Error ? e.message : undefined,
      });
    });
  const handleRestore = (n: CrmDeletedNotification) =>
    restoreCrmNotification(n)
      .then(() => toast.success("Notification restored"))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to restore notification", {
          description: e instanceof Error ? e.message : undefined,
        });
      });
  const handlePermanentDelete = async (id: string): Promise<void> => {
    try {
      await permanentlyDeleteCrmNotification(id, user);
      toast.success("Notification permanently deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to permanently delete notification", {
        description: e instanceof Error ? e.message : undefined,
      });
      throw e;
    }
  };

  const goToSource = (n: CrmNotification) => {
    setOpen(false);
    if (!n.isRead) markCrmNotificationRead(n.id).catch((e) => console.error(e));
    navigate(SOURCE_ROUTES[n.sourceTab]);
  };

  const renderItem = (n: CrmNotification) => {
    const Icon = SOURCE_ICON[n.sourceTab];
    return (
      <div
        key={n.id}
        className="px-4 py-3 hover:bg-emerald-50/40 transition-colors border-b border-slate-200"
      >
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <button
                className="text-left text-sm font-semibold text-slate-800 leading-snug hover:underline flex items-center gap-1.5"
                onClick={() => goToSource(n)}
              >
                {!n.isRead && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0"
                    title="Unread"
                  />
                )}
                {n.title}
              </button>
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0 mt-1.5",
                  PRIORITY_DOT[n.priority],
                )}
                title={`${n.priority} priority`}
              />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{n.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {n.companyName && (
                <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {n.companyName}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                <Calendar className="h-3 w-3" />
                {n.dueDate}
                {n.dueTime ? ` · ${n.dueTime}` : ""}
              </span>
              <span
                className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full",
                  STATUS_STYLE[n.status],
                )}
              >
                {n.status}
              </span>
              <span className="text-sm text-slate-400">
                {n.relatedTabLabel}
              </span>
            </div>

            {/* Action-based workflow — Phase 5 */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {(n.status === "Pending" || n.status === "Overdue") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg"
                  onClick={() => handleAcknowledge(n.id)}
                >
                  <Check className="h-3 w-3 mr-1" /> Acknowledge
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs rounded-lg"
                onClick={() => handleDone(n.id)}
              >
                <Check className="h-3 w-3 mr-1" /> Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs rounded-lg"
                onClick={() =>
                  setSnoozeOpenFor(snoozeOpenFor === n.id ? null : n.id)
                }
              >
                <AlarmClockOff className="h-3 w-3 mr-1" /> Snooze
              </Button>
              {n.status === "Snoozed" && n.snoozeUntil && (
                <span className="text-sm text-purple-600 flex items-center gap-1">
                  <Clock3 className="h-3 w-3" /> until{" "}
                  {new Date(n.snoozeUntil).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {n.status === "Done" && isCrmAdmin(user) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                  onClick={() => handleDelete(n)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>

            {snoozeOpenFor === n.id && (
              <div className="mt-2 p-2 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-1.5">
                {snoozePresets().map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2 text-xs rounded-lg"
                    onClick={() => handleSnooze(n.id, p.until())}
                  >
                    {p.label}
                  </Button>
                ))}
                <DateTimePicker
                  value=""
                  className="h-6 text-xs w-40"
                  onChange={(v) => {
                    const ts = v ? new Date(v).getTime() : NaN;
                    if (!Number.isNaN(ts)) handleSnooze(n.id, ts);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRecycleItem = (n: CrmDeletedNotification) => {
    const Icon = SOURCE_ICON[n.sourceTab];
    return (
      <div
        key={n.id}
        className="px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-200"
      >
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700 leading-snug">
              {n.title}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{n.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {n.companyName && (
                <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {n.companyName}
                </span>
              )}
              <span className="text-sm text-slate-400">
                Deleted{" "}
                {new Date(n.deletedAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {n.deletedBy ? ` · ${n.deletedBy}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs rounded-lg"
                onClick={() => handleRestore(n)}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restore
              </Button>
              {isCrmAdmin(user) && (
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs rounded-lg border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete permanently
                    </Button>
                  }
                  title="Permanently delete notification?"
                  description="This notification will be permanently removed and cannot be restored. The underlying CRM record is never affected."
                  confirmLabel="Delete permanently"
                  onConfirm={() => handlePermanentDelete(n.id)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-all duration-150"
        onClick={() => setOpen((v) => !v)}
        title="CRM Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {attentionCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 min-w-[18px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shadow-sm px-0.5">
            {attentionCount > 99 ? "99+" : attentionCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed right-4 top-16 w-[26rem] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[560px]"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-slate-800">
                  CRM Notifications
                </p>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {overdueCount} overdue · {todayCount} due today ·{" "}
                {tomorrowCount} tomorrow
              </p>
              <div className="flex items-center gap-1 mt-2.5">
                {(
                  [
                    {
                      key: "active",
                      label: "Action Required",
                      count: active.length,
                    },
                    {
                      key: "completed",
                      label: "Completed",
                      count: done.length,
                    },
                    {
                      key: "recycle",
                      label: "Recycle Bin",
                      count: recycled.length,
                    },
                  ] as { key: ViewMode; label: string; count: number }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setViewMode(t.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                      viewMode === t.key
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-brand-50 hover:text-brand-700",
                    )}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {viewMode === "active" &&
                (active.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">
                      Nothing needs attention
                    </p>
                    <p className="text-sm text-slate-400/80 mt-1">
                      CRM follow-ups &amp; meetings will show up here.
                    </p>
                  </div>
                ) : (
                  GROUP_ORDER.map((g) =>
                    grouped[g].length === 0 ? null : (
                      <div key={g}>
                        <div
                          className={cn(
                            "px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider border-b border-t",
                            GROUP_STYLE[g],
                          )}
                        >
                          {g} ({grouped[g].length})
                        </div>
                        {grouped[g].map(renderItem)}
                      </div>
                    ),
                  )
                ))}

              {viewMode === "completed" &&
                (done.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Check className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Nothing completed yet</p>
                  </div>
                ) : (
                  done.map(renderItem)
                ))}

              {viewMode === "recycle" &&
                (recycled.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Recycle Bin is empty</p>
                    <p className="text-sm text-slate-400/80 mt-1">
                      Deleted notifications can be restored from here.
                    </p>
                  </div>
                ) : (
                  recycled.map(renderRecycleItem)
                ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
