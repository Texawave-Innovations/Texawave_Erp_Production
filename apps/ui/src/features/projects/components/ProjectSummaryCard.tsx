import { CheckCircle2, Circle } from "lucide-react";
import { SectionCard, cn } from "@texawave-erp/ui-kit";

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryCheck {
  label: string;
  done: boolean;
  /** Required fields block saving; the rest are only suggestions. */
  required: boolean;
}

interface ProjectSummaryCardProps {
  code: string;
  /** True once the project has a saved code (edit); false while it is a preview. */
  codeIsFinal: boolean;
  rows: readonly SummaryRow[];
  checks: readonly SummaryCheck[];
}

/** Live summary of the project being set up: its code, the key figures and
 * what is still missing. Read-only; the form owns all the values. */
export function ProjectSummaryCard({
  code,
  codeIsFinal,
  rows,
  checks,
}: ProjectSummaryCardProps) {
  const missingRequired = checks.filter((c) => c.required && !c.done).length;
  return (
    <SectionCard
      title="Project summary"
      description="Updates as you fill in the form"
    >
      <div>
        <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          Project code
        </p>
        <p className="break-all text-theme-lg font-semibold text-brand-700 dark:text-cyan-300">
          {code}
        </p>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {codeIsFinal
            ? "Assigned when the project was created."
            : "The number is assigned when you save."}
        </p>
      </div>

      <dl className="flex flex-col gap-2 border-t border-gray-100 pt-4 text-theme-sm dark:border-gray-800">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-gray-500 dark:text-gray-400">
              {row.label}
            </dt>
            <dd className="min-w-0 text-right font-medium text-gray-900 dark:text-white/90">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <p
          className="mb-2 text-theme-xs font-medium text-gray-500 dark:text-gray-400"
          aria-live="polite"
        >
          {missingRequired === 0
            ? "All required fields are filled"
            : `${missingRequired} required ${missingRequired === 1 ? "field" : "fields"} still missing`}
        </p>
        <ul className="flex flex-col gap-1.5">
          {checks.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-center gap-2 text-theme-sm",
                c.done
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-500 dark:text-gray-400",
              )}
            >
              {c.done ? (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-success-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600"
                  aria-hidden="true"
                />
              )}
              <span>{c.label}</span>
              <span className="ml-auto text-theme-xs text-gray-400 dark:text-gray-500">
                {c.required ? "Required" : "Recommended"}
              </span>
              <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
