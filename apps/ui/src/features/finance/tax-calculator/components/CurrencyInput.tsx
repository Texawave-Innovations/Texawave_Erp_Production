"use client";

import React from "react";
import { sanitizeNumericInput } from "../engine/formatters";

interface CurrencyInputProps {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  symbolClassName?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/**
 * Shared ₹ numeric field: sanitizes input and hides 0 on focus/edit for clean typing.
 * Strictly adheres to AGENTS.md: Nunito Sans, no font-mono.
 */
export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "0",
  symbolClassName = "text-lg font-semibold text-slate-500 mr-2",
  className = "text-lg font-semibold",
  id,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  return (
    <div className="flex items-baseline">
      <span className={symbolClassName}>₹</span>
      <input
        id={id}
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        min="0"
        value={value === 0 ? "" : value}
        onChange={(e) => onValueChange(sanitizeNumericInput(e.target.value))}
        placeholder={placeholder}
        className={`w-full min-h-12 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none ${className}`}
      />
    </div>
  );
}
