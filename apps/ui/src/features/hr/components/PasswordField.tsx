"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { Input, type InputProps } from "@texawave-erp/ui-kit";

export interface PasswordFieldProps extends Omit<InputProps, "type"> {
  value: string;
  showRequirements?: boolean;
}

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

/**
 * Enterprise Password Field with show/hide visibility toggle and live
 * password requirement checklist derived from strongPasswordSchema.
 */
export function PasswordField({
  value,
  showRequirements = true,
  disabled,
  className = "",
  ...props
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Input
          {...props}
          type={showPassword ? "text" : "password"}
          value={value}
          disabled={disabled}
          className={`pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-brand-500 rounded-r-md transition-colors"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {showRequirements && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Password requirements
          </p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-theme-xs">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.isMet(value);

              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 transition-colors duration-200 ${
                    met
                      ? "text-success-700 dark:text-success-300 font-semibold"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {met ? (
                    <Check
                      className="h-3.5 w-3.5 text-success-600 dark:text-success-400 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0"
                      aria-hidden="true"
                    />
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
}
