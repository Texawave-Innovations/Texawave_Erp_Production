import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { DatePicker } from "../date-picker/index";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  align?: "left" | "right" | "auto" | undefined;
  placement?: "top" | "bottom" | "auto" | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, align, placement, className, ...props },
  ref,
) {
  if (props.type === "date") {
    const { type: _type, ...rest } = props;
    return (
      <DatePicker
        ref={ref}
        invalid={invalid}
        align={align}
        placement={placement}
        className={className}
        {...rest}
      />
    );
  }

  if (props.type === "month") {
    const { type: _type, ...rest } = props;
    return (
      <DatePicker
        ref={ref}
        mode="month"
        invalid={invalid}
        align={align}
        placement={placement}
        className={className}
        {...rest}
      />
    );
  }

  if (props.type === "datetime-local") {
    const { type: _type, ...rest } = props;
    return (
      <DatePicker
        ref={ref}
        mode="datetime"
        invalid={invalid}
        align={align}
        placement={placement}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <input
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
});
