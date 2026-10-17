import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string | undefined;
  current?: boolean | undefined;
  icon?: ReactNode | undefined;
}

export type BreadcrumbsTone = "neutral" | "banner";

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items: readonly (string | BreadcrumbItem)[];
  separator?: ReactNode | undefined;
  ariaLabel?: string | undefined;
  tone?: BreadcrumbsTone | undefined;
  className?: string | undefined;
}

/**
 * Reusable Global Breadcrumbs navigation.
 * Standardizes hierarchy path across TexaOne ERP modules.
 * Renders semantic navigation, accessible separators, and aria-current="page".
 */
export function Breadcrumbs({
  items,
  separator = "›",
  ariaLabel = "Breadcrumb",
  tone = "neutral",
  className,
  ...rest
}: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Normalize items to typed structure
  const normalizedItems: BreadcrumbItem[] = items.map((item, idx) => {
    if (typeof item === "string") {
      return {
        label: item,
        current: idx === items.length - 1,
      };
    }
    return {
      ...item,
      current: item.current ?? idx === items.length - 1,
    };
  });

  const isBanner = tone === "banner";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex items-center", className)}
      {...rest}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-theme-xs font-medium">
        {normalizedItems.map((item, idx) => {
          const isCurrent = Boolean(item.current);
          const showSeparator = idx > 0;

          return (
            <li
              key={
                typeof item.label === "string" ? `${item.label}-${idx}` : idx
              }
              className="flex items-center gap-1.5 min-w-0"
            >
              {showSeparator && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "select-none px-0.5",
                    isBanner
                      ? "text-[#0a3271]/50 dark:text-sky-400/50"
                      : "text-gray-400 dark:text-gray-600",
                  )}
                >
                  {separator}
                </span>
              )}

              {isCurrent ? (
                <span
                  aria-current="page"
                  className={cn(
                    "truncate font-semibold",
                    isBanner
                      ? "text-[#0a3271] dark:text-sky-100"
                      : "text-gray-900 dark:text-white/90",
                  )}
                >
                  {item.icon && (
                    <span
                      className="mr-1.5 inline-flex items-center"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  className={cn(
                    "inline-flex items-center truncate transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded",
                    isBanner
                      ? "text-[#0a3271]/80 hover:text-[#0a3271] dark:text-sky-300 dark:hover:text-white focus-visible:outline-[#0a3271]"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus-visible:outline-brand-500",
                  )}
                >
                  {item.icon && (
                    <span
                      className="mr-1.5 inline-flex items-center"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </a>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isBanner
                      ? "text-[#0a3271]/70 dark:text-sky-300/70"
                      : "text-gray-500 dark:text-gray-400",
                  )}
                >
                  {item.icon && (
                    <span
                      className="mr-1.5 inline-flex items-center"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
