"use client";

import type { ReactNode } from "react";
import { Button } from "@texawave-erp/ui-kit";

export interface FormActionBarProps {
  dirty?: boolean;
  dirtyLabel?: string;
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Standard enterprise floating bottom Action Bar for HR forms and edit wizards.
 * Displays dirty state indicator, Cancel button, and Primary Submit button.
 */
export function FormActionBar({
  dirty,
  dirtyLabel = "Unsaved changes",
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save changes",
  loading = false,
  disabled = false,
  className = "",
  children,
}: FormActionBarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-sky-200/90 bg-white p-4.5 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700 dark:bg-gray-900 ${className}`}
    >
      <div>
        {dirty ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {dirtyLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        {children}
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading || disabled}
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading || disabled}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
