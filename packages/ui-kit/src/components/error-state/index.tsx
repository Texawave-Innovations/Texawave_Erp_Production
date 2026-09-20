import { Button } from "../button/index";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** A request failed — distinct from `EmptyState` ("nothing here") on
 * purpose, always with a retry when one is possible
 * (Docs/DESIGN_SYSTEM.md "Never use an empty state to hide a request
 * failure"). */
export function ErrorState({
  title = "Something went wrong",
  description = "The request failed. Try again, and if it keeps happening, let your team know.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <p className="text-theme-sm font-medium text-error-700 dark:text-error-300">
        {title}
      </p>
      <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
