import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid = false, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-3",
          "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-300",
          "dark:bg-gray-dark dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:border-gray-700",
          invalid
            ? "border-error-500 focus:border-error-500 focus:ring-error-500/20 dark:border-error-400"
            : "border-gray-500 hover:border-gray-700 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-500 dark:hover:border-gray-400",
          className,
        )}
        {...props}
      />
    );
  },
);
