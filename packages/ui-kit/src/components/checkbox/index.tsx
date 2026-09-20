import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-gray-300 text-brand-500 shadow-theme-xs",
          "focus:outline-none focus:ring-3 focus:ring-brand-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-gray-700 dark:bg-gray-dark",
          className,
        )}
        {...props}
      />
    );
  },
);
