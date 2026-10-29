"use client";

import { useDepartments } from "@/features/departments/hooks";

export interface DepartmentMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Multi-department chip-toggle — legacy `ProjectForm.tsx`'s department
 * selection UX (a project can span more than one department). */
export function DepartmentMultiSelect({
  value,
  onChange,
  disabled,
}: DepartmentMultiSelectProps) {
  const query = useDepartments({ limit: 100 });
  const departments = query.data?.data ?? [];

  function toggle(name: string) {
    if (value.includes(name)) {
      onChange(value.filter((d) => d !== name));
    } else {
      onChange([...value, name]);
    }
  }

  if (query.isPending) {
    return (
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Loading departments...
      </p>
    );
  }

  if (departments.length === 0) {
    return (
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        No departments configured yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((dept) => {
        const active = value.includes(dept.name);
        return (
          <button
            key={dept.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(dept.name)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "border-transparent bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {dept.name}
          </button>
        );
      })}
    </div>
  );
}
