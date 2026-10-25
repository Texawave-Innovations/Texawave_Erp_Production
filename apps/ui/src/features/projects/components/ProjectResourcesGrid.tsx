"use client";

import type { EmployeeListItem } from "@/features/hr/employees/types";

function matchesDepartment(
  empTeamName: string,
  departments: string[],
): boolean {
  if (departments.length === 0) return true;
  const target = empTeamName.trim().toLowerCase();
  return departments.some((d) => {
    const dept = d.trim().toLowerCase();
    return target === dept || target.includes(dept) || dept.includes(target);
  });
}

/** Filters an employee list to the given department names — matches legacy
 * `ProjectForm.tsx`'s fuzzy department match (exact or substring, either
 * direction). This app's closest equivalent to legacy's free-text employee
 * "department" field is `Employee.team`. */
export function filterEmployeesByDepartments(
  employees: EmployeeListItem[],
  departments: string[],
): EmployeeListItem[] {
  return employees.filter((e) => matchesDepartment(e.team.name, departments));
}

export interface ProjectResourcesGridProps {
  employees: EmployeeListItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/** Legacy `ProjectForm.tsx` "Project Resources (Team Members)" checkbox
 * grid, filtered to the selected departments (filter employees with
 * `filterEmployeesByDepartments` before passing them in). */
export function ProjectResourcesGrid({
  employees,
  selectedIds,
  onChange,
}: ProjectResourcesGridProps) {
  function toggle(id: number) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-xs italic text-gray-400 dark:border-gray-700 dark:bg-gray-800">
        No employees matching the selected department(s).
      </div>
    );
  }

  return (
    <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-3">
      {employees.map((e) => {
        const isSelected = selectedIds.includes(e.id);
        return (
          <button
            type="button"
            key={e.id}
            onClick={() => toggle(e.id)}
            className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-bold transition-all ${
              isSelected
                ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] ${
                isSelected
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-300 dark:border-gray-600"
              }`}
            >
              {isSelected ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="block truncate">{e.fullName}</span>
              <span className="block truncate text-[10px] font-normal text-gray-400">
                {e.team.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
