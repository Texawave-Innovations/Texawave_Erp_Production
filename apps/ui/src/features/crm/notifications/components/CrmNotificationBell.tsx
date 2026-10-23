"use client";

import type {
  CrmNotification,
  CrmNotificationTab,
} from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import { DeleteConfirmDialog } from "@/features/crm/legacy-ui/CrmCommon";
import { DateTimePicker } from "@/features/crm/legacy-ui/DateTimePicker";
import { usePermission } from "@/hooks/usePermission";
import {
  AlarmClockOff,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  Clock3,
  Handshake,
  Inbox,
  ListChecks,
  Receipt,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  useAcknowledgeNotification,
  useDeleteNotification,
  useMarkNotificationDone,
  useMarkNotificationRead,
  useNotificationFeed,
  usePermanentlyDeleteNotification,
  useRestoreNotification,
  useSnoozeNotification,
} from "../hooks";
import {
  GROUP_ORDER,
  GROUP_STYLE,
  groupFor,
  snoozePresets,
  SOURCE_LABEL,
  sourceRoute,
  type NotificationGroup,
} from "../grouping";

const TABS: { key: CrmNotificationTab; label: string }[] = [
  { key: "active", label: "Action Required" },
  { key: "completed", label: "Completed" },
  { key: "deleted", label: "Recycle Bin" },
];

const SOURCE_ICON: Record<CrmNotification["sourceType"], LucideIcon> = {
  meeting: CalendarClock,
  followUp: Clock3,
  task: ListChecks,
  opportunity: Briefcase,
  quotation: Receipt,
  account: Handshake,
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

/**
 * CRM notification bell (legacy `CrmNotificationBell.tsx`): popup with
 * Action Required / Completed / Recycle Bin tabs. Acknowledge, Done and Snooze
 * need `crm.notification.write`; deleting a Completed notification into the
 * Recycle Bin and deleting it permanently need `crm.notification.delete`
 * (admin only); restoring needs write.
 */
export function CrmNotificationBell() {
  const router = useRouter();
  const canWrite = usePermission("crm.notification.write");
  const canDelete = usePermission("crm.notification.delete");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CrmNotificationTab>("active");
  const [snoozeFor, setSnoozeFor] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const active = useNotificationFeed("active", true);
  const completed = useNotificationFeed("completed", open);
  const deleted = useNotificationFeed("deleted", open);
  const counts = active.data?.counts;

  const acknowledge = useAcknowledgeNotification();
  const markDone = useMarkNotificationDone();
  const snooze = useSnoozeNotification();
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();
  const restore = useRestoreNotification();
  const purge = usePermanentlyDeleteNotification();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
        setSnoozeFor(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeItems = useMemo(() => active.data?.items ?? [], [active.data]);
  const grouped = useMemo(() => {
    const map: Record<NotificationGroup, CrmNotification[]> = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      Snoozed: [],
      Upcoming: [],
    };
    activeItems.forEach((n) => map[groupFor(n)].push(n));
    return map;
  }, [activeItems]);
  const overdue = grouped.Overdue.length;
  const today = grouped.Today.length;
  const tomorrow = grouped.Tomorrow.length;

  async function run(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
    } catch {
      toast.error(failure);
    }
  }

  function goToSource(n: CrmNotification) {
    setOpen(false);
    if (!n.isRead && canWrite) markRead.mutate(n.id);
    router.push(sourceRoute(n));
  }

  function renderItem(n: CrmNotification) {
    const Icon = SOURCE_ICON[n.sourceType];
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
                type="button"
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
            {n.description && (
              <p className="text-sm text-slate-500 mt-0.5">{n.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {n.companyName && (
                <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {n.companyName}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                <Calendar className="h-3 w-3" />
                {n.dueDate.slice(0, 10)}
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
                {SOURCE_LABEL[n.sourceType]}
              </span>
            </div>

            {/* Action-based workflow */}
            {canWrite && n.status !== "Done" && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {(n.status === "Pending" || n.status === "Overdue") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs rounded-lg"
                    onClick={() =>
                      void run(
                        () => acknowledge.mutateAsync(n.id),
                        "Could not acknowledge notification",
                      )
                    }
                  >
                    <Check className="h-3 w-3 mr-1" /> Acknowledge
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg"
                  onClick={() => {
                    setSnoozeFor(null);
                    void run(
                      () => markDone.mutateAsync(n.id),
                      "Could not mark notification done",
                    );
                  }}
                >
                  <Check className="h-3 w-3 mr-1" /> Done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg"
                  onClick={() => setSnoozeFor(snoozeFor === n.id ? null : n.id)}
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
              </div>
            )}
            {n.status === "Done" && canDelete && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                  onClick={() =>
                    void run(
                      () => remove.mutateAsync(n.id),
                      "Failed to delete notification",
                    )
                  }
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            )}

            {snoozeFor === n.id && (
              <div className="mt-2 p-2 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-1.5">
                {snoozePresets().map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2 text-xs rounded-lg"
                    onClick={() => {
                      setSnoozeFor(null);
                      void run(
                        () =>
                          snooze.mutateAsync({
                            id: n.id,
                            input: { until: p.until().toISOString() },
                          }),
                        "Could not snooze notification",
                      );
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
                <DateTimePicker
                  value=""
                  className="h-6 text-xs w-40"
                  onChange={(v) => {
                    const ts = v ? new Date(v) : null;
                    if (!ts || Number.isNaN(ts.getTime())) return;
                    setSnoozeFor(null);
                    void run(
                      () =>
                        snooze.mutateAsync({
                          id: n.id,
                          input: { until: ts.toISOString() },
                        }),
                      "Snooze time must be in the future",
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderDeleted(n: CrmNotification) {
    const Icon = SOURCE_ICON[n.sourceType];
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
            {n.description && (
              <p className="text-sm text-slate-500 mt-0.5">{n.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {n.companyName && (
                <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {n.companyName}
                </span>
              )}
              <span className="text-sm text-slate-400">
                Deleted{" "}
                {n.deletedAt
                  ? new Date(n.deletedAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs rounded-lg"
                  onClick={() =>
                    void run(
                      () =>
                        restore.mutateAsync(n.id).then(() => {
                          toast.success("Notification restored");
                        }),
                      "Failed to restore notification",
                    )
                  }
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Restore
                </Button>
              )}
              {canDelete && (
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
                  onConfirm={async () => {
                    try {
                      await purge.mutateAsync(n.id);
                    } catch (e) {
                      toast.error("Failed to permanently delete notification");
                      throw e;
                    }
                    toast.success("Notification permanently deleted");
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const listFor = (key: CrmNotificationTab) =>
    key === "completed" ? completed.data?.items : deleted.data?.items;
  const unread = counts?.unread ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="CRM notifications"
        aria-expanded={open}
        title="CRM Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-all duration-150"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shadow-sm px-0.5">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed right-4 top-16 w-[26rem] max-w-[92vw] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[560px]"
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-slate-800">
                  CRM Notifications
                </p>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {overdue} overdue · {today} due today · {tomorrow} tomorrow
              </p>
              <div className="flex items-center gap-1 mt-2.5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                      tab === t.key
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-brand-50 hover:text-brand-700",
                    )}
                  >
                    {t.label} (
                    {t.key === "active"
                      ? (counts?.active ?? 0)
                      : t.key === "completed"
                        ? (completed.data?.counts.completed ??
                          counts?.completed ??
                          0)
                        : (deleted.data?.counts.deleted ??
                          counts?.deleted ??
                          0)}
                    )
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {tab === "active" &&
                (activeItems.length === 0 ? (
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

              {tab === "completed" &&
                ((listFor("completed") ?? []).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Check className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Nothing completed yet</p>
                  </div>
                ) : (
                  (listFor("completed") ?? []).map(renderItem)
                ))}

              {tab === "deleted" &&
                ((listFor("deleted") ?? []).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Recycle Bin is empty</p>
                    <p className="text-sm text-slate-400/80 mt-1">
                      Deleted notifications can be restored from here.
                    </p>
                  </div>
                ) : (
                  (listFor("deleted") ?? []).map(renderDeleted)
                ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
