import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-800",
        className,
      )}
      {...props}
    />
  );
}
