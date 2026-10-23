"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { AlertVariant } from "../alert/index";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: AlertVariant;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "border-sky-200/90 bg-white/95 text-sky-900 shadow-sky-500/10 dark:border-sky-800 dark:bg-gray-900/95 dark:text-sky-200",
  success:
    "border-emerald-200/90 bg-white/95 text-emerald-900 shadow-emerald-500/10 dark:border-emerald-800 dark:bg-gray-900/95 dark:text-emerald-200",
  warning:
    "border-amber-200/90 bg-white/95 text-amber-900 shadow-amber-500/10 dark:border-amber-800 dark:bg-gray-900/95 dark:text-amber-200",
  error:
    "border-rose-200/90 bg-white/95 text-rose-900 shadow-rose-500/10 dark:border-rose-800 dark:bg-gray-900/95 dark:text-rose-200",
};

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 2500;

/** App-wide toast host — mount once near the root (Docs/DESIGN_SYSTEM.md
 * "Forms/tables/navigation"). `useToast()` anywhere below it to fire one. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();

      setToasts((current) => {
        const next = [...current, { ...input, id }];
        if (next.length > MAX_TOASTS) {
          const dropCount = next.length - MAX_TOASTS;
          const dropped = next.slice(0, dropCount);
          dropped.forEach((item) => {
            const timer = timersRef.current.get(item.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(item.id);
            }
          });
          return next.slice(dropCount);
        }
        return next;
      });

      const timer = setTimeout(() => {
        dismiss(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.9,
                transition: { duration: 0.15 },
              }}
              transition={{ duration: 0.2 }}
              role={item.variant === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto rounded-xl border p-3.5 text-theme-xs shadow-lg backdrop-blur-xs transition-colors",
                VARIANT_CLASSES[item.variant ?? "info"],
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold tracking-tight">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs opacity-90 truncate">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() must be used within a <ToastProvider>");
  }
  return context;
}
