"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue, useEmployees } from "@/features/hr/employees/hooks";

export interface ResourceNamesInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Name-based resource assignment — legacy `ProjectForm.tsx` exact parity
 * (an array of employee display names, not IDs). Typeahead searches the
 * employee directory; any typed name can still be added free-form, matching
 * legacy behaviour. */
export function ResourceNamesInput({
  value,
  onChange,
  disabled,
}: ResourceNamesInputProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const employeesQuery = useEmployees(
    debouncedSearch
      ? { page: 1, limit: 8, search: debouncedSearch }
      : { page: 1, limit: 8 },
  );

  const suggestions = (employeesQuery.data?.data ?? []).filter(
    (e) => !value.includes(e.fullName),
  );

  function addName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setSearch("");
  }

  function removeName(name: string) {
    onChange(value.filter((n) => n !== name));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((name) => (
          <span
            key={name}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {name}
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeName(name)}
                aria-label={`Remove ${name}`}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {!disabled ? (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addName(search);
              }
            }}
            placeholder="Type a name and press Enter, or pick from search..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
          />
          {search && suggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {suggestions.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => addName(e.fullName)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {e.fullName}{" "}
                    <span className="text-gray-400">({e.employeeCode})</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
