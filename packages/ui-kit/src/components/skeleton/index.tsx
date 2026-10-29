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
        "animate-pulse motion-reduce:animate-none rounded-md bg-gray-200 dark:bg-[#1C2029]",
        className,
      )}
      {...props}
    />
  );
}
