"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
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
  info: "border-brand-200 bg-white text-brand-800 dark:border-brand-800 dark:bg-gray-dark dark:text-brand-200",
  success:
    "border-success-200 bg-white text-success-800 dark:border-success-800 dark:bg-gray-dark dark:text-success-200",
  warning:
    "border-warning-200 bg-white text-warning-800 dark:border-warning-800 dark:bg-gray-dark dark:text-warning-200",
  error:
    "border-error-200 bg-white text-error-800 dark:border-error-800 dark:bg-gray-dark dark:text-error-200",
};

const AUTO_DISMISS_MS = 5000;

/** App-wide toast host — mount once near the root (Docs/DESIGN_SYSTEM.md
 * "Forms/tables/navigation"). `useToast()` anywhere below it to fire one. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...input, id }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
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
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto rounded-lg border p-4 text-theme-sm shadow-theme-lg",
              VARIANT_CLASSES[item.variant ?? "info"],
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 opacity-90">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
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
