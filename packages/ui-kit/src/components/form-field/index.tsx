import { useId } from "react";
import { cn } from "../../lib/cn";

/** How a field's error is shown: plain text under the control (default),
 * or a callout bubble with a pointer to the control. */
export type FormFieldErrorVariant = "text" | "bubble";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  // `| undefined` explicitly — see packages/core/src/api/client.ts for why
  // this pattern shows up repeatedly under exactOptionalPropertyTypes: it
  // lets a caller pass `error={maybeUndefinedString}` without having to
  // prune the key first.
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  /** Default `"text"`. `"bubble"` is for forms that validate each field as
   * it is left (see apps/ui/src/hooks/useFormValidation.ts). */
  errorVariant?: FormFieldErrorVariant | undefined;
  /**
   * Optional trailing content rendered on the same row as the label (e.g. a
   * "Forgot your password?" link next to a Password field's label).
   */
  labelAction?: React.ReactNode;
  children: (fieldProps: {
    id: string;
    "aria-describedby": string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}

/**
 * Wires a label, hint, and error message to one control with the right
 * `aria-describedby`/`aria-invalid` wiring — every form field in the app
 * uses this rather than hand-assembling `<label>` + input + error text each
 * time (Docs/DESIGN_SYSTEM.md "Shared component contracts").
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  errorVariant = "text",
  labelAction,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-theme-sm font-medium text-gray-700 dark:text-white/90"
        >
          {label}
          {required ? <span className="ml-0.5 text-error-500">*</span> : null}
        </label>
        {labelAction}
      </div>
      {children({
        id,
        "aria-describedby": describedBy,
        invalid: Boolean(error),
      })}
      {hint && !error ? (
        <p
          id={hintId}
          className="text-theme-xs text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      ) : null}
      {error && errorVariant === "bubble" ? (
        // In the layout flow (not floating), so several bubbles at once
        // never cover the fields below them.
        <div
          id={errorId}
          role="alert"
          className="relative mt-1 flex items-start gap-1.5 rounded-lg border border-error-200 bg-error-50 px-2.5 py-1.5 text-theme-xs font-medium text-error-700 shadow-theme-xs dark:border-error-800 dark:bg-error-950 dark:text-error-300"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 left-4 h-2.5 w-2.5 rotate-45 border-l border-t border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950"
          />
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </div>
      ) : null}
      {error && errorVariant === "text" ? (
        <p
          id={errorId}
          role="alert"
          className={cn("text-theme-xs text-error-600 dark:text-error-400")}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
