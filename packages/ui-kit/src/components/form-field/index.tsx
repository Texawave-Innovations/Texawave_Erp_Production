import { useId } from "react";
import { cn } from "../../lib/cn";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  // `| undefined` explicitly — see packages/core/src/api/client.ts for why
  // this pattern shows up repeatedly under exactOptionalPropertyTypes: it
  // lets a caller pass `error={maybeUndefinedString}` without having to
  // prune the key first.
  error?: string | undefined;
  hint?: string;
  required?: boolean;
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
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-theme-sm font-medium text-gray-700 dark:text-white/90"
      >
        {label}
        {required ? <span className="ml-0.5 text-error-500">*</span> : null}
      </label>
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
      {error ? (
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
