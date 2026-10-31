"use client";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "../../lib/cn";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  invalid?: boolean | undefined;
  clearable?: boolean | undefined;
  onClear?: (() => void) | undefined;
  onChangeValue?: ((value: string) => void) | undefined;
  inputClassName?: string | undefined;
  iconClassName?: string | undefined;
  clearButtonAriaLabel?: string | undefined;
  sizeVariant?: "sm" | "md" | "lg" | undefined;
}

function SearchIcon({
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
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
 * Reusable SearchInput component conforming to TexaOne design system.
 * Renders an accessible search control with magnifying glass and quick-clear action.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      onChangeValue,
      onClear,
      clearable = true,
      invalid = false,
      disabled = false,
      readOnly = false,
      placeholder = "Search...",
      clearButtonAriaLabel = "Clear search",
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

    const hasValue = value !== undefined && String(value).length > 0;
    const canClear = clearable && hasValue && !disabled && !readOnly;

    const handleClear = () => {
      if (disabled || readOnly) return;
      onClear?.();
      onChangeValue?.("");

      if (onChange && inputRef.current) {
        // Construct standard synthetic change event for backwards compatibility
        const nativeInput = inputRef.current;
        nativeInput.value = "";
        const event = {
          target: nativeInput,
          currentTarget: nativeInput,
        } as unknown as ChangeEvent<HTMLInputElement>;
        onChange(event);
      }

      inputRef.current?.focus();
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onChangeValue?.(e.target.value);
    };

    return (
      <div className={cn("relative flex-1", className)}>
        {/* Leading Magnifying Glass Icon */}
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-gray-500",
            iconClassName,
          )}
        >
          <SearchIcon className="h-4 w-4" />
        </span>

        {/* Input Control */}
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className={cn(
            "block w-full rounded-lg border bg-white pl-10 pr-9 shadow-theme-xs transition-colors",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-3",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-300",
            "dark:bg-gray-dark dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:border-gray-700",
            SIZE_CLASSES[sizeVariant],
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden",
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
