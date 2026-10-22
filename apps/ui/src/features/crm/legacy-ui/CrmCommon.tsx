"use client";

// Ports of the small shared pieces legacy kept in `intelligence/components.tsx`
// (EmptyState, DeleteConfirmDialog) and `domain/currency.ts` (money helpers).
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/legacy-ui/alert-dialog";
import { AlertTriangle, Loader2, Trash2, type LucideIcon } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string | undefined;
}) {
  return (
    <div className="text-center py-10 text-slate-400">
      <Icon className="h-9 w-9 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && (
        <p className="text-sm text-slate-400/80 mt-1">{description}</p>
      )}
    </div>
  );
}

export function DeleteConfirmDialog({
  trigger,
  title,
  description,
  warning,
  confirmLabel = "Delete",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  warning?: string | undefined;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete — please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setOpen(v);
          if (!v) setError(null);
        }
      }}
    >
      <AlertDialogTrigger
        asChild
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="h-8 w-8 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
              <Trash2 className="h-4 w-4" />
            </span>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {warning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{warning}</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={busy}
            className="border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-400 gap-1.5"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {busy ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};

export function currencySymbol(code?: string | null): string {
  const c = code || "INR";
  return CURRENCY_SYMBOLS[c] || `${c} `;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, code?: string | null): string {
  const formatted = round2(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(code)}${formatted}`;
}

export const QUOTATION_STATUS_STYLE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Expired: "bg-amber-50 text-amber-700 border-amber-200",
};
