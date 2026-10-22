import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { isValidElement } from "react";
import { cn } from "../../lib/cn";
import { Breadcrumbs, type BreadcrumbItem } from "../breadcrumbs";

export type PageHeaderVariant = "neutral" | "banner";

export interface PageHeaderProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title"
> {
  title: ReactNode;
  description?: ReactNode | undefined;
  icon?: ComponentType<{ className?: string }> | ReactNode | undefined;
  badge?: ReactNode | undefined;
  breadcrumbs?: readonly (string | BreadcrumbItem)[] | undefined;
  breadcrumbsSlot?: ReactNode | undefined;
  action?: ReactNode | undefined;
  primaryAction?: ReactNode | undefined;
  secondaryActions?: ReactNode | undefined;
  variant?: PageHeaderVariant | undefined;
  className?: string | undefined;
}

function renderHeaderIcon(
  icon: PageHeaderProps["icon"],
  className: string,
): ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const IconComponent = icon as ComponentType<{ className?: string }>;
  return <IconComponent className={className} aria-hidden="true" />;
}

/**
 * Standardized Global PageHeader component.
 * Supports both clean neutral surfaces and full-width gradient banners.
 * Accommodates breadcrumbs, leading icons, status badges, and action groups.
 */
export function PageHeader({
  title,
  description,
  icon,
  badge,
  breadcrumbs,
  breadcrumbsSlot,
  action,
  primaryAction,
  secondaryActions,
  variant = "neutral",
  className,
  ...rest
}: PageHeaderProps) {
  const actionsContent =
    action ??
    (primaryAction || secondaryActions ? (
      <>
        {secondaryActions}
        {primaryAction}
      </>
    ) : null);

  const hasBreadcrumbs =
    Boolean(breadcrumbsSlot) ||
    (Array.isArray(breadcrumbs) && breadcrumbs.length > 0);

  if (variant === "banner") {
    return (
      <header
        className={cn(
          "relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-sky-200/60 bg-linear-to-r from-[#478cf9] via-25%-[#9EDCF7] via-25% to-[#49aff8] via-50% to-[#8BE9F0] via-40% to-[#81edf5] p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(56,189,248,0.14)] dark:border-sky-800/40 dark:from-[#0d2238] dark:via-[#132d4b] dark:to-[#0f2844]",
          className,
        )}
        {...rest}
      >
        {hasBreadcrumbs && (
          <div className="text-[#0a3271]/80 dark:text-sky-300/80">
            {breadcrumbsSlot ?? (
              <Breadcrumbs items={breadcrumbs ?? []} tone="banner" />
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {icon && (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white shadow-[0_6px_20px_rgba(30,100,180,0.12),0_1px_3px_rgba(15,23,42,0.04)] dark:border-gray-700/80 dark:bg-gray-800/90">
                {renderHeaderIcon(
                  icon,
                  "h-7 w-7 text-brand-600 dark:text-cyan-400",
                )}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                  {title}
                </h1>
                {badge}
              </div>
              {description && (
                <p className="mt-0.5 max-w-2xl text-theme-xs sm:text-theme-sm font-medium text-[#2f6396] dark:text-sky-300/80">
                  {description}
                </p>
              )}
            </div>
          </div>

          {actionsContent && (
            <div className="banner-actions flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
              {actionsContent}
            </div>
          )}
        </div>
      </header>
    );
  }

  // Default "neutral" variant
  return (
    <header className={cn("flex flex-col gap-3", className)} {...rest}>
      {hasBreadcrumbs && (
        <div>
          {breadcrumbsSlot ?? (
            <Breadcrumbs items={breadcrumbs ?? []} tone="neutral" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 shadow-theme-xs">
              {renderHeaderIcon(icon, "h-5 w-5")}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-title-sm sm:text-title-md font-bold tracking-tight text-gray-900 dark:text-white/90">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>

        {actionsContent && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {actionsContent}
          </div>
        )}
      </div>
    </header>
  );
}
