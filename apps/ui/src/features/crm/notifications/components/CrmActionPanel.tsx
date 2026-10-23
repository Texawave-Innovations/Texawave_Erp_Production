"use client";

import type { CrmNotification } from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import { cn } from "@/components/legacy-ui/utils";
import {
  AlarmClockOff,
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Check,
  Flag,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useAcknowledgeNotification,
  useMarkNotificationDone,
  useMarkNotificationRead,
  useNotificationFeed,
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

const HEADER_STYLE: Record<NotificationGroup, string> = {
  Overdue: "bg-red-600",
  Today: "bg-amber-500",
  Tomorrow: "bg-blue-500",
  Snoozed: "bg-slate-500",
  Upcoming: "bg-emerald-600",
};
const BORDER_STYLE: Record<NotificationGroup, string> = {
  Overdue: "border-red-300",
  Today: "border-amber-300",
  Tomorrow: "border-blue-300",
  Snoozed: "border-slate-300",
  Upcoming: "border-emerald-300",
};
const ICON_STYLE: Record<NotificationGroup, string> = {
  Overdue: "text-red-600",
  Today: "text-amber-500",
  Tomorrow: "text-blue-500",
  Snoozed: "text-slate-500",
  Upcoming: "text-emerald-600",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Any notification still awaiting a decision interrupts the user
 * (legacy `isActionRequired`): Acknowledged / Done / Snoozed never qualify. */
function isActionRequired(n: CrmNotification): boolean {
  return n.status === "Pending" || n.status === "Overdue";
}

/**
 * Full-screen BLOCKING panel (legacy `CrmActionPanel.tsx`). A true modal lock:
 * a backdrop swallows every pointer event, body/wheel/touch scrolling is
 * disabled, Tab focus is trapped inside, Escape and backdrop clicks are
 * no-ops, and there is no close button. The only way an item leaves the queue
 * is a successful Acknowledge / Done / Snooze (the feed refetch drops it).
 * Mounted once for CRM pages by `CrmNotificationHost`, only for users who can
 * act (`crm.notification.write`) - otherwise they could never dismiss it.
 */
export function CrmActionPanel() {
  const router = useRouter();
  const feed = useNotificationFeed("active", true);
  const acknowledge = useAcknowledgeNotification();
  const markDone = useMarkNotificationDone();
  const snooze = useSnoozeNotification();
  const markRead = useMarkNotificationRead();
  const [snoozeOpenFor, setSnoozeOpenFor] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const busy = acknowledge.isPending || markDone.isPending || snooze.isPending;

  // Overdue first, then today, tomorrow, upcoming; earliest due first.
  const queue = useMemo(() => {
    const rank = (n: CrmNotification) => GROUP_ORDER.indexOf(groupFor(n));
    return (feed.data?.items ?? [])
      .filter(isActionRequired)
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          a.dueDate.localeCompare(b.dueDate) ||
          a.createdAt.localeCompare(b.createdAt),
      );
  }, [feed.data]);
  const current = queue[0];
  const currentId = current?.id;

  // Snooze menu belongs to the notification on screen: keyed by id so it
  // resets whenever the front of the queue changes.
  const snoozeOpen = snoozeOpenFor !== null && snoozeOpenFor === currentId;

  useEffect(() => {
    if (currentId === undefined) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const blockScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", blockScroll, { passive: false });
    document.addEventListener("touchmove", blockScroll, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const container = panelRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (!container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("wheel", blockScroll);
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(focusTimer);
      previouslyFocused?.focus?.();
    };
    // Keyed on the id so a background feed refetch does not re-trap focus.
  }, [currentId]);

  if (!current) return null;

  const group = groupFor(current);

  async function run(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
    } catch {
      toast.error(failure);
    }
  }

  const goToSource = () => {
    if (!current.isRead) markRead.mutate(current.id);
    router.push(sourceRoute(current));
  };

  const isOverdue = group === "Overdue";

  return createPortal(
    <>
      {/* Deliberately no onClick: clicking the backdrop must never close the panel. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[10200] bg-slate-900/60 backdrop-blur-sm"
        onClick={(e) => e.preventDefault()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="CRM action required"
        ref={panelRef}
        className="fixed inset-0 z-[10210] grid place-items-center p-4"
      >
        <div
          className={cn(
            "w-[min(96vw,58rem)] max-h-[92vh] overflow-y-auto rounded-2xl border-2 shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-200",
            BORDER_STYLE[group],
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2 px-8 py-5 text-white",
              HEADER_STYLE[group],
            )}
          >
            <div className="flex items-center gap-2.5">
              <Bell className="h-6 w-6" />
              <span className="text-xl font-extrabold uppercase tracking-wider">
                CRM Action Required
              </span>
              {queue.length > 1 && (
                <span className="ml-1 px-2.5 py-1 rounded-full bg-white/20 text-base">
                  {queue.length} pending
                </span>
              )}
            </div>
          </div>

          <div className="px-8 py-7">
            <div className="flex items-start gap-4">
              <span className={cn("mt-0.5 shrink-0", ICON_STYLE[group])}>
                <AlertTriangle className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={goToSource}
                  className="text-left text-2xl font-bold text-slate-800 leading-snug hover:underline"
                >
                  {current.title}
                </button>
                {current.description && (
                  <p className="text-lg text-slate-500 mt-1.5">
                    {current.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-lg text-slate-600">
              {current.companyName && (
                <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                  <Building2 className="h-6 w-6 text-slate-400 shrink-0" />
                  <span className="font-semibold">Account:</span>{" "}
                  {current.companyName}
                </div>
              )}
              {current.prospectName && (
                <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                  <User className="h-6 w-6 text-slate-400 shrink-0" />
                  <span className="font-semibold">Contact:</span>{" "}
                  {current.prospectName}
                </div>
              )}
              <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                <Calendar className="h-6 w-6 text-slate-400 shrink-0" />
                <span className="font-semibold">
                  {isOverdue ? "Was due:" : "Due:"}
                </span>{" "}
                {current.dueDate.slice(0, 10)}
                <span
                  className={cn(
                    "ml-1 text-sm font-semibold uppercase px-2.5 py-0.5 rounded-full border",
                    GROUP_STYLE[group],
                  )}
                >
                  {group}
                </span>
              </div>
              <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                <Flag className="h-6 w-6 text-slate-400 shrink-0" />
                <span className="font-semibold">Priority:</span>
                <span
                  className={cn(
                    "text-sm font-semibold uppercase px-2.5 py-0.5 rounded-full",
                    current.priority === "high"
                      ? "bg-red-100 text-red-700"
                      : current.priority === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600",
                  )}
                >
                  {current.priority}
                </span>
              </div>
              <div className="flex items-center gap-2.5 col-span-2">
                <Tag className="h-6 w-6 text-slate-400 shrink-0" />
                <span className="font-semibold">Source:</span>{" "}
                {SOURCE_LABEL[current.sourceType]}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 mt-7">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg"
                onClick={() =>
                  void run(
                    () => acknowledge.mutateAsync(current.id),
                    "Could not acknowledge notification — please try again.",
                  )
                }
              >
                <Check className="h-5 w-5 mr-2" /> Acknowledge
              </Button>
              <Button
                size="sm"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg bg-emerald-600 hover:bg-emerald-700"
                onClick={() =>
                  void run(
                    () =>
                      markDone.mutateAsync(current.id).then(() => {
                        toast.success("Marked as done.");
                      }),
                    "Could not save — the notification is still Action Required.",
                  )
                }
              >
                <Check className="h-5 w-5 mr-2" /> Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg"
                onClick={() => setSnoozeOpenFor(snoozeOpen ? null : current.id)}
              >
                <AlarmClockOff className="h-5 w-5 mr-2" /> Snooze
              </Button>
            </div>

            {snoozeOpen && (
              <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-2.5">
                {snoozePresets().map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    className="h-10 px-4 text-base rounded-lg"
                    onClick={() => {
                      setSnoozeOpenFor(null);
                      void run(
                        () =>
                          snooze.mutateAsync({
                            id: current.id,
                            input: { until: p.until().toISOString() },
                          }),
                        "Could not snooze notification — please try again.",
                      );
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
