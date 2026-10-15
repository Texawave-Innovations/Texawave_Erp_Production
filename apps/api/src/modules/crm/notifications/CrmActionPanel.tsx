// Prominent top action panel for CRM notifications that still need a decision (any unresolved
// Pending/Overdue item — overdue, due today, due tomorrow, or further out — see
// `isActionRequired` below; Acknowledged/Done/Snoozed items never qualify). This is the single
// on-screen alert surface for the whole bell feed: every such notification is shown here as a
// full-screen popup instead of a corner toast, so nothing can be missed. This is a BEHAVIOR layer
// on top of the existing `crm/notifications/feed` data and the existing Acknowledge/Done/Snooze
// actions in CrmNotificationBell.tsx — it reuses the same service functions and never introduces a
// new notification state.
//
// This is a true modal lock, not just a high z-index: while an action-required notification is
// showing, a full-screen backdrop blocks every pointer/touch event to the rest of the page,
// page/body scrolling and background wheel/touch scrolling are disabled, and Tab-focus is trapped
// inside the panel — so nothing behind it is clickable, scrollable, or even keyboard-reachable.
// Clicking the backdrop and pressing Escape are both explicitly no-ops, and there is no close/✕
// affordance: the panel can only go away as a side effect of Acknowledge/Done/Snooze successfully
// writing to Firebase (the feed subscription below then drops the item out of the queue). Portaled
// to `document.body` so it always renders above the entire CRM page — header, sidebar, tabs, and
// every other CRM overlay (e.g. the celebration layer) — regardless of where in the component tree
// it's mounted.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Check,
  AlarmClockOff,
  User,
  Flag,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acknowledgeCrmNotification,
  markCrmNotificationDone,
  markCrmNotificationRead,
  snoozeCrmNotification,
} from "./crmNotificationService";
import { useCrmNotificationFeed } from "./notificationFeedContext";
import { CrmNotification } from "./types";
import {
  Group,
  GROUP_ORDER,
  GROUP_STYLE,
  groupFor,
  SOURCE_ROUTES,
  snoozePresets,
} from "./notificationGrouping";

const GROUP_RANK: Record<Group, number> = Object.fromEntries(
  GROUP_ORDER.map((g, i) => [g, i]),
) as Record<Group, number>;

const HEADER_STYLE: Record<Group, string> = {
  Overdue: "bg-red-600",
  Today: "bg-amber-500",
  Tomorrow: "bg-blue-500",
  Snoozed: "bg-slate-500",
  Upcoming: "bg-emerald-600",
};

const BORDER_STYLE: Record<Group, string> = {
  Overdue: "border-red-300",
  Today: "border-amber-300",
  Tomorrow: "border-blue-300",
  Snoozed: "border-slate-300",
  Upcoming: "border-emerald-300",
};

const ICON_STYLE: Record<Group, string> = {
  Overdue: "text-red-600",
  Today: "text-amber-500",
  Tomorrow: "text-blue-500",
  Snoozed: "text-slate-500",
  Upcoming: "text-emerald-600",
};

/**
 * Any notification still awaiting a decision — overdue, due today, due tomorrow, or further out —
 * interrupts the user with this full-screen panel. Snoozed, Acknowledged, and Done notifications
 * never qualify: they've already had a decision made and stay purely in the bell dropdown.
 */
function isActionRequired(n: CrmNotification): boolean {
  return n.status === "Pending" || n.status === "Overdue";
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CrmActionPanel() {
  const navigate = useNavigate();
  const feed = useCrmNotificationFeed();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Queue: overdue first, then today, tomorrow, upcoming; within a group, earliest due first. An
  // item leaves the queue only when a real action (Acknowledge/Done/Snooze) has changed its
  // Firebase `status` — there is no local/visual-only dismissal, so the notification cannot be
  // bypassed without that.
  const queue = useMemo(() => {
    return Object.values(feed)
      .filter(isActionRequired)
      .sort((a, b) => {
        const gr = GROUP_RANK[groupFor(a)] - GROUP_RANK[groupFor(b)];
        if (gr !== 0) return gr;
        const dueCmp = a.dueDate.localeCompare(b.dueDate);
        if (dueCmp !== 0) return dueCmp;
        return a.createdAt - b.createdAt;
      });
  }, [feed]);

  const current = queue[0];

  // The snooze menu's open/closed state belongs to whichever notification is on screen — reset it
  // whenever the front-of-queue item changes (Acknowledge/Done advancing to the next one included,
  // not just Snooze closing its own menu), so a newly-shown notification never renders with the
  // previous one's snooze menu already expanded.
  useEffect(() => {
    setSnoozeOpen(false);
  }, [current?.id]);

  // True modal lock while a notification is showing: block body scroll, block wheel/touch
  // scrolling anywhere outside the panel (belt-and-braces alongside the portal below, which
  // already keeps the panel out of the scrollable CRM content area), swallow Escape, and trap
  // Tab focus inside the panel — so neither mouse, wheel/touch, nor keyboard can reach or scroll
  // the page behind it.
  useEffect(() => {
    if (!current) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const blockScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", blockScroll, { passive: false });
    document.addEventListener("touchmove", blockScroll, { passive: false });

    const blockEscapeAndTrapFocus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const container = panelRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
    document.addEventListener("keydown", blockEscapeAndTrapFocus, true);

    // Move focus into the panel once it's mounted, so keyboard interaction starts inside it.
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("wheel", blockScroll);
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("keydown", blockEscapeAndTrapFocus, true);
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
    // Keyed on the notification's id, not the `current` object reference — `queue`/`current` get a
    // new object identity on every `feed` update (even an unrelated write from another user or the
    // 60s rescan), which would otherwise tear down and re-add every listener and yank focus back to
    // the first button on each one, even though the visible panel hasn't actually changed.
  }, [current?.id]);

  if (!current) return null;

  const group = groupFor(current);
  const isOverdue = group === "Overdue";

  const handleAcknowledge = async () => {
    setBusy(true);
    try {
      await acknowledgeCrmNotification(current.id);
    } catch (e) {
      console.error(e);
      toast.error("Could not acknowledge notification — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    setBusy(true);
    try {
      await markCrmNotificationDone(current.id);
      toast.success("Marked as done.");
    } catch (e) {
      console.error(e);
      toast.error(
        "Could not save — the notification is still Action Required.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = async (until: number) => {
    setBusy(true);
    setSnoozeOpen(false);
    try {
      await snoozeCrmNotification(current.id, until);
    } catch (e) {
      console.error(e);
      toast.error("Could not snooze notification — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const goToSource = () => {
    if (!current.isRead)
      markCrmNotificationRead(current.id).catch((e) => console.error(e));
    navigate(SOURCE_ROUTES[current.sourceTab]);
  };

  return createPortal(
    <>
      {/* Full-screen modal backdrop — blocks every pointer/touch event to the rest of the CRM
          page, with a visible dim + blur so the locked background reads as inert. Deliberately
          has no onClick handler: clicking it must never close the panel. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[10200] bg-slate-900/60 backdrop-blur-sm"
        onClick={(e) => e.preventDefault()}
      />
      {/* Centered on the viewport, above every other CRM overlay (including the celebration
          layer, which tops out at z-index 10120). */}
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
                <p className="text-lg text-slate-500 mt-1.5">
                  {current.description}
                </p>
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
                {current.dueDate}
                {current.dueTime ? ` · ${current.dueTime}` : ""}
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
              {current.relatedTabLabel && (
                <div className="flex items-center gap-2.5 col-span-2">
                  <Tag className="h-6 w-6 text-slate-400 shrink-0" />
                  <span className="font-semibold">Source:</span>{" "}
                  {current.relatedTabLabel}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3.5 mt-7">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg"
                onClick={handleAcknowledge}
              >
                <Check className="h-5 w-5 mr-2" /> Acknowledge
              </Button>
              <Button
                size="sm"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDone}
              >
                <Check className="h-5 w-5 mr-2" /> Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-12 px-5 text-base rounded-lg"
                onClick={() => setSnoozeOpen((v) => !v)}
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
                    onClick={() => handleSnooze(p.until())}
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
