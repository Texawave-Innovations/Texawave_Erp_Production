"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Star,
  Ticket,
  Receipt,
  Clock,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { Spinner, Semantic3DIcon } from "@texawave-erp/ui-kit";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../hooks";
import type { AppNotification } from "../types";

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Recently";
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `${day} ${month}, ${time}`;
}

interface CategoryStyle {
  label: string;
  pillClass: string;
  iconBg: string;
  iconColor: string;
  Icon: typeof Bell;
}

function resolveNotificationStyle(n: AppNotification): CategoryStyle {
  const t = (n.type || "").toLowerCase();
  const title = (n.title || "").toLowerCase();

  if (
    t.includes("attendance") ||
    t.includes("check_in") ||
    t.includes("check_out") ||
    title.includes("check-in") ||
    title.includes("regularization")
  ) {
    const isApproved = title.includes("approved");
    const isReminder =
      title.includes("reminder") ||
      title.includes("pending") ||
      title.includes("late");
    return {
      label: "attendance",
      pillClass:
        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-cyan-300 dark:border-sky-800",
      iconBg:
        "bg-sky-50 border-sky-200/90 dark:bg-sky-950/80 dark:border-sky-800",
      iconColor: "text-brand-600 dark:text-cyan-400",
      Icon: isApproved ? CheckCircle2 : isReminder ? Star : Clock,
    };
  }

  if (t.includes("ticket") || title.includes("ticket")) {
    return {
      label: "Ticket",
      pillClass:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      iconBg:
        "bg-blue-50 border-blue-200/90 dark:bg-blue-950/80 dark:border-blue-800",
      iconColor: "text-brand-600 dark:text-cyan-300",
      Icon: Ticket,
    };
  }

  if (t.includes("expense") || title.includes("expense")) {
    return {
      label: "Expense",
      pillClass:
        "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
      iconBg:
        "bg-cyan-50 border-cyan-200/90 dark:bg-cyan-950/80 dark:border-cyan-800",
      iconColor: "text-cyan-600 dark:text-cyan-300",
      Icon: Receipt,
    };
  }

  if (
    t.includes("task") ||
    title.includes("task") ||
    title.includes("follow-up") ||
    title.includes("overdue")
  ) {
    return {
      label: "Task",
      pillClass:
        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      iconBg:
        "bg-amber-50 border-amber-200/90 dark:bg-amber-950/80 dark:border-amber-800",
      iconColor: "text-amber-600 dark:text-amber-400",
      Icon: title.includes("overdue") ? AlertCircle : ClipboardList,
    };
  }

  if (
    t.includes("leave") ||
    t.includes("loan") ||
    title.includes("leave") ||
    title.includes("loan")
  ) {
    return {
      label: "HR",
      pillClass:
        "bg-blue-50 text-brand-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      iconBg:
        "bg-blue-50 border-blue-200/90 dark:bg-blue-950/80 dark:border-blue-800",
      iconColor: "text-brand-600 dark:text-cyan-400",
      Icon: CalendarCheck,
    };
  }

  return {
    label: "HR",
    pillClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconBg:
      "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
    iconColor: "text-brand-600 dark:text-cyan-400",
    Icon: Star,
  };
}

/**
 * Header notification bell conforming to TexaOne design standards.
 * Features:
 * - Live unread badge count
 * - Dynamic category filters (HR, attendance, Task, Ticket, Expense)
 * - Leading category iconography matching reference style
 * - Detailed timestamps & readable notification cards
 * - Mark individual and Mark all as read
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const unread = useUnreadNotificationCount();
  const list = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data ?? 0;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function normalizeNotificationLink(
    link?: string | null,
    type?: string,
  ): string {
    const isAdmin =
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/portal");

    if (!link) {
      if (isAdmin) {
        if (
          type?.includes("attendance.correction") ||
          type?.includes("regularization")
        ) {
          return "/hr/regularization";
        }
        if (type?.includes("attendance")) return "/hr/attendance";
        if (type?.includes("task")) return "/hr/tasks";
        if (type?.includes("ticket")) return "/hr/tickets";
        if (type?.includes("expense")) return "/hr/expense-approvals";
        if (type?.includes("leave")) return "/hr/leaves?tab=approvals";
        if (type?.includes("exit")) return "/hr/exit-requests";
        return "/hr/dashboard";
      }
      if (type?.includes("attendance")) return "/portal";
      if (type?.includes("task")) return "/portal/tasks";
      if (type?.includes("ticket")) return "/portal/tickets";
      if (type?.includes("expense")) return "/portal/expense-claims";
      if (type?.includes("leave")) return "/portal/leave";
      if (type?.includes("exit")) return "/portal/exit-requests";
      return "/portal";
    }

    let resolved = link;
    // Admin route normalizations
    if (resolved === "/hr/expenses" || resolved.startsWith("/hr/expenses?")) {
      resolved = resolved.replace("/hr/expenses", "/hr/expense-approvals");
    }
    if (resolved === "/hr/leave" || resolved.startsWith("/hr/leave?")) {
      resolved = resolved.replace("/hr/leave", "/hr/leaves");
    }

    // Employee portal route normalizations
    if (resolved.startsWith("/portal/expenses")) {
      resolved = resolved.replace("/portal/expenses", "/portal/expense-claims");
    }
    if (resolved.startsWith("/self-service/attendance")) {
      resolved = "/portal";
    }
    if (resolved.startsWith("/self-service/tasks")) {
      resolved = resolved.replace("/self-service/tasks", "/portal/tasks");
    }
    if (resolved.startsWith("/self-service/tickets")) {
      resolved = resolved.replace("/self-service/tickets", "/portal/tickets");
    }
    return resolved;
  }

  function openItem(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    const target = normalizeNotificationLink(n.link, n.type);
    router.push(target);
  }

  // Derive unique categories present in the notification list
  const allNotifications = list.data?.data ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of allNotifications) {
      const style = resolveNotificationStyle(item);
      set.add(style.label);
    }
    return Array.from(set);
  }, [allNotifications]);

  const filteredNotifications = useMemo(() => {
    if (!selectedCategory) return allNotifications;
    return allNotifications.filter((n) => {
      const style = resolveNotificationStyle(n);
      return style.label.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [allNotifications, selectedCategory]);

  const totalCount = list.data?.meta?.total ?? allNotifications.length;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={
          count > 0 ? `Notifications, ${count} unread` : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/70 backdrop-blur-md text-slate-600 hover:bg-white hover:text-slate-900 shadow-2xs focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-sky-900/40 dark:bg-gray-800/70 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-all cursor-pointer"
      >
        <Semantic3DIcon name="bell" size={20} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="glass-dropdown absolute right-0 z-50 mt-2 w-84 sm:w-92 rounded-[24px] p-2 sm:p-2.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100 border border-sky-100/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-sky-100/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Bell className="h-3.5 w-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Notifications
              </span>
            </div>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 dark:text-cyan-400 hover:underline disabled:opacity-50 cursor-pointer transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills (Matches Reference Screenshots) */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-sky-100/60 dark:border-slate-800/80 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-all cursor-pointer ${
                  selectedCategory === null
                    ? "bg-linear-to-r from-brand-600 to-sky-600 text-white border-brand-600 shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                All
              </button>
              {categories.map((cat) => {
                const isActive =
                  selectedCategory?.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isActive ? null : cat)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-linear-to-r from-brand-600 to-sky-600 text-white border-brand-600 shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Notification Items List */}
          <div className="max-h-96 overflow-y-auto px-1 py-1.5 space-y-1">
            {list.isPending ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5 text-brand-600 dark:text-cyan-400" />
              </div>
            ) : list.isError ? (
              <p className="py-6 text-center text-xs text-rose-500 font-medium">
                Could not load notifications.
              </p>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                {selectedCategory
                  ? `No ${selectedCategory} notifications found.`
                  : "You're all caught up."}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNotifications.map((n) => {
                  const style = resolveNotificationStyle(n);
                  const Icon = style.Icon;

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openItem(n)}
                      className={`group flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all cursor-pointer border ${
                        n.readAt
                          ? "border-transparent bg-white/40 hover:bg-sky-50/70 hover:border-sky-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                          : "border-sky-100 bg-sky-50/60 hover:bg-sky-50/90 dark:border-sky-900/40 dark:bg-brand-950/20"
                      }`}
                    >
                      {/* Leading Circle Icon Avatar */}
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-2xs transition-transform group-hover:scale-105 ${style.iconBg} ${style.iconColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {n.title}
                          </p>
                          {!n.readAt && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>

                        {/* Metadata Tag Pill + Date (Matches Screenshots) */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${style.pillClass}`}
                          >
                            {style.label}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatNotificationDate(n.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer (Matches Reference Screenshots) */}
          <div className="px-3 py-2 border-t border-sky-100/70 dark:border-slate-800 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {totalCount} notification{totalCount === 1 ? "" : "s"} · Showing
            latest 40
          </div>
        </div>
      )}
    </div>
  );
}
