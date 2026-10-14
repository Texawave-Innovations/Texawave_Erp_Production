"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Spinner } from "@texawave-erp/ui-kit";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../hooks";
import type { AppNotification } from "../types";

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/**
 * Header bell for the caller's in-app inbox: unread badge (polled), the
 * latest 20 notifications, open-and-mark-read, and mark-all-read.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = useUnreadNotificationCount();
  const list = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data ?? 0;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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

  function openItem(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={
          count > 0 ? `Notifications, ${count} unread` : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <Bell className="h-4.5 w-4.5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </span>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-theme-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isPending ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : list.isError ? (
              <p className="p-4 text-theme-xs text-error-600">
                Could not load notifications.
              </p>
            ) : list.data.data.length === 0 ? (
              <p className="p-6 text-center text-theme-xs text-gray-500 dark:text-gray-400">
                You're all caught up.
              </p>
            ) : (
              <ul>
                {list.data.data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800/60 dark:hover:bg-gray-800/50 ${n.readAt ? "" : "bg-brand-50/50 dark:bg-brand-950/20"}`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand-500"}`}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
                          {n.title}
                          {n.readAt ? null : (
                            <span className="sr-only"> (unread)</span>
                          )}
                        </span>
                        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                          {n.body}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {ago(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
