"use client";

import { Eye } from "lucide-react";
import { Alert, Card, Skeleton } from "@texawave-erp/ui-kit";

/**
 * The live A4 preview of a Sales document: the server-rendered HTML the PDF
 * is made from, shown in a sandboxed iframe (no scripts, no same-origin
 * access). `stale` keeps the last good preview visible, dimmed, while a new
 * one loads or when the form has errors.
 */
export function DocumentPreviewPanel({
  html,
  loading,
  stale,
  error,
  emptyMessage,
  title,
}: {
  html: string | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  emptyMessage: string;
  title: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-theme-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Live preview
        </h2>
        <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-theme-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {loading ? "Updating…" : "A4"}
        </span>
      </div>
      {error ? (
        <Alert variant="warning" title="Preview not updated">
          {error}
        </Alert>
      ) : null}
      {html ? (
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          className={`aspect-[210/297] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700 ${
            stale ? "opacity-60" : ""
          }`}
        />
      ) : loading ? (
        <Skeleton className="aspect-[210/297] w-full" />
      ) : (
        <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-6 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {emptyMessage}
        </div>
      )}
    </Card>
  );
}
