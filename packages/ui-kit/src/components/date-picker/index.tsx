"use client";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "../../lib/cn";

export interface DatePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onChange?: ((e: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onChangeDate?: ((date: string) => void) | undefined;
  min?: string | undefined;
  max?: string | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  clearable?: boolean | undefined;
  onClear?: (() => void) | undefined;
  invalid?: boolean | undefined;
  className?: string | undefined;
  inputClassName?: string | undefined;
  iconClassName?: string | undefined;
  clearButtonAriaLabel?: string | undefined;
  sizeVariant?: "sm" | "md" | "lg" | undefined;
}

function CalendarIcon({
  className = "h-4 w-4",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CloseIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const SIZE_CLASSES = {
  sm: "h-9 py-1.5 text-theme-xs",
  md: "h-10 py-2.5 text-theme-sm",
  lg: "h-11 py-3 text-theme-base",
};

/**
 * Reusable single-date DatePicker component conforming to TexaOne design system.
 * Uses native calendar date input to guarantee zero timezone distortion and full browser accessibility.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
      value,
      defaultValue,
      onChange,
      onChangeDate,
      min,
      max,
      minDate,
      maxDate,
      clearable = true,
      onClear,
      invalid = false,
      disabled = false,
      readOnly = false,
      clearButtonAriaLabel = "Clear date",
      sizeVariant = "md",
      className,
      inputClassName,
      iconClassName,
      ...props
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const effectiveMin = minDate ?? min;
    const effectiveMax = maxDate ?? max;
    const hasValue = value !== undefined && value !== "";
    const canClear = clearable && hasValue && !disabled && !readOnly;

    const handleClear = () => {
      if (disabled || readOnly) return;
      onClear?.();
      onChangeDate?.("");

      if (inputRef.current) {
        inputRef.current.value = "";
        if (onChange) {
          const event = {
            target: inputRef.current,
            currentTarget: inputRef.current,
          } as unknown as ChangeEvent<HTMLInputElement>;
          onChange(event);
        }
      }

      inputRef.current?.focus();
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onChangeDate?.(e.target.value);
    };

    const handleOpenPicker = () => {
      if (disabled || readOnly) return;
      try {
        if (
          inputRef.current &&
          typeof (
            inputRef.current as HTMLInputElement & { showPicker?: () => void }
          ).showPicker === "function"
        ) {
          (
            inputRef.current as HTMLInputElement & { showPicker: () => void }
          ).showPicker();
        } else {
          inputRef.current?.focus();
        }
      } catch {
        inputRef.current?.focus();
      }
    };

    return (
      <div className={cn("relative flex-1", className)}>
        {/* Leading Calendar Icon */}
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpenPicker}
          disabled={disabled || readOnly}
          className={cn(
            "absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 transition-colors",
            (disabled || readOnly) && "pointer-events-none opacity-60",
            iconClassName,
          )}
          aria-hidden="true"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>

        {/* Native Date Input */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          min={effectiveMin}
          max={effectiveMax}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          className={cn(
            "block w-full rounded-lg border bg-white pl-10 pr-9 shadow-theme-xs transition-colors",
            "text-gray-900 placeholder:text-gray-400",
            "focus:outline-none focus:ring-3",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-300",
            "dark:bg-gray-dark dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:border-gray-700",
            SIZE_CLASSES[sizeVariant],
            invalid
              ? "border-error-500 focus:border-error-500 focus:ring-error-500/20 dark:border-error-400"
              : "border-gray-500 hover:border-gray-700 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-500 dark:hover:border-gray-400",
            inputClassName,
          )}
          {...props}
        />

        {/* Trailing Clear Button */}
        {canClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={clearButtonAriaLabel}
            tabIndex={0}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 rounded-r-md"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
