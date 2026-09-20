import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Only for "there is genuinely nothing here" or "no results match" — never
 * used to paper over a failed request (that's `ErrorState`). See
 * Docs/DESIGN_SYSTEM.md "Never use an empty state to hide a request
 * failure". */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-theme-sm font-medium text-gray-700 dark:text-white/90">
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
