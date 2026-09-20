import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs",
        "dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
      {...props}
    />
  );
}
