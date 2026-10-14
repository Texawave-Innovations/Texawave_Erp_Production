"use client";

import {
  type InputHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";

export interface PasswordRule {
  id: string;
  label: string;
  isMet: (val: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    isMet: (v) => v.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A–Z)",
    isMet: (v) => /[A-Z]/.test(v),
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a–z)",
    isMet: (v) => /[a-z]/.test(v),
  },
  {
    id: "number",
    label: "One number (0–9)",
    isMet: (v) => /\d/.test(v),
  },
  {
    id: "special",
    label: "One special character (!@#$%...)",
    isMet: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  invalid?: boolean | undefined;
  showRequirements?: boolean | undefined;
  rules?: PasswordRule[] | undefined;
  toggleAriaLabel?: string | undefined;
  inputClassName?: string | undefined;
}

function EyeIcon({
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function CheckIcon({
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CircleIcon({
  className = "h-3 w-3",
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
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/**
 * Reusable PasswordField control conforming to TexaOne design system.
 * Features an accessible password reveal toggle and an optional live requirement checklist.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      value = "",
      showRequirements = false,
      rules = PASSWORD_RULES,
      invalid = false,
      disabled = false,
      className,
      inputClassName,
      toggleAriaLabel,
      ...props
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const [showPassword, setShowPassword] = useState(false);
    const stringValue = typeof value === "string" ? value : String(value ?? "");

    const handleToggle = () => {
      if (disabled) return;
      setShowPassword((prev) => !prev);
    };

    return (
      <div className={cn("flex flex-col gap-2.5", className)}>
        <div className="relative">
          <input
            ref={inputRef}
            type={showPassword ? "text" : "password"}
            value={value}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn(
              "block w-full rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-theme-sm text-gray-900 shadow-theme-xs transition-colors",
              "placeholder:text-gray-400",
              "focus:outline-none focus:ring-3",
              "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-300",
              "dark:bg-gray-dark dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:border-gray-700",
              invalid
                ? "border-error-500 focus:border-error-500 focus:ring-error-500/20 dark:border-error-400"
                : "border-gray-500 hover:border-gray-700 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-500 dark:hover:border-gray-400",
              inputClassName,
            )}
            {...props}
          />

          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            aria-label={
              toggleAriaLabel ??
              (showPassword ? "Hide password" : "Show password")
            }
            className={cn(
              "absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-brand-500 rounded-r-md transition-colors",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {showRequirements && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Password requirements
            </p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-theme-xs">
              {rules.map((rule) => {
                const met = rule.isMet(stringValue);

                return (
                  <li
                    key={rule.id}
                    className={cn(
                      "flex items-center gap-2 transition-colors duration-200",
                      met
                        ? "text-success-700 dark:text-success-300 font-semibold"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                  >
                    {met ? (
                      <span className="text-success-600 dark:text-success-400 shrink-0">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 shrink-0">
                        <CircleIcon className="h-3 w-3" />
                      </span>
                    )}
                    <span className="text-[11px]">{rule.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  },
);
