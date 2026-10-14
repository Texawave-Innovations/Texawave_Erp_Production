"use client";

import { Lock } from "lucide-react";
import {
  SCOPE_HINTS,
  SCOPE_LABELS,
  SCOPES,
  type AccessAction,
  type Level,
} from "../utils/access-model";

const BASE =
  "relative px-2.5 py-1 text-theme-xs font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40";

function tone(selected: boolean, level: Level): string {
  if (!selected) {
    return "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800";
  }
  if (level === "none")
    return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
  if (level === "own")
    return "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200";
  if (level === "team") return "bg-brand-500 text-white";
  return "bg-brand-700 text-white";
}

/**
 * One action's level in a role. Team-scoped actions get a segmented
 * None / Own / Team / All radio group (only one scope is ever granted);
 * flat actions get a switch. A reserved `.own` (refused by the API) is
 * disabled with the reason in its tooltip.
 */
export function ScopeControl({
  action,
  level,
  onChange,
  disabled = false,
  labelPrefix,
}: {
  action: AccessAction;
  level: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
  /** Accessible name prefix, e.g. "Attendance". */
  labelPrefix: string;
}) {
  const name = `${labelPrefix}: ${action.label}`;

  if (action.kind === "flat") {
    const on = level === "granted";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={name}
        title={action.description}
        disabled={disabled}
        onClick={() => onChange(on ? "none" : "granted")}
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-40 ${
          on
            ? "border-brand-600 bg-brand-600"
            : "border-gray-300 bg-gray-200 dark:border-gray-700 dark:bg-gray-800"
        }`}
      >
        <span
          className={`mx-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-theme-xs transition-transform ${on ? "translate-x-5" : ""}`}
        />
      </button>
    );
  }

  const options: Level[] = [
    "none",
    ...SCOPES.filter((s) => action.ids[s] !== undefined),
  ];
  return (
    <div
      role="radiogroup"
      aria-label={name}
      title={action.description}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {options.map((option) => {
        const reserved = option === "own" && action.ownReserved;
        const selected = level === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || (reserved && !selected)}
            title={
              reserved
                ? "Not available: nobody may do this on their own record"
                : option === "none"
                  ? "No access"
                  : SCOPE_HINTS[option as keyof typeof SCOPE_HINTS]
            }
            onClick={() => onChange(option)}
            className={`${BASE} ${tone(selected, option)} border-l border-gray-200 first:border-l-0 dark:border-gray-700`}
          >
            {option === "none"
              ? "None"
              : SCOPE_LABELS[option as keyof typeof SCOPE_LABELS]}
            {reserved ? (
              <Lock aria-hidden className="ml-0.5 inline h-3 w-3" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
