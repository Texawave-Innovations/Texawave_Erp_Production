import type { ReactNode } from "react";

export interface DetailItem {
  label: string;
  value: ReactNode;
}

/** Read-only label/value grid used by the Recruitment detail dialogs. */
export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            {item.label}
          </dt>
          <dd className="break-words text-theme-sm text-gray-900 dark:text-white/90">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
