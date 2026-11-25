import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SectionCardProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title"
> {
  title: ReactNode;
  description?: ReactNode | undefined;
  /** Trailing content in the title bar (e.g. a count or a button). */
  action?: ReactNode | undefined;
}

/**
 * A form/page section: a title bar in the same gradient as the banner
 * `PageHeader`, over a white body. Use for long forms split into sections.
 */
export function SectionCard({
  title,
  description,
  action,
  className,
  children,
  ...rest
}: SectionCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white card-light-shadow dark:border-slate-800 dark:bg-gray-dark",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-linear-135 from-[#38bdf8] via-[#0ea5e9] to-[#2dd4bf] px-5 py-3.5 text-white dark:bg-linear-to-r dark:from-[#131722] dark:via-[#0E111A] dark:to-[#08090D] dark:text-[#F8FAFC]">
        <div className="min-w-0">
          <h2 id={headingId} className="text-theme-lg font-bold">
            {title}
          </h2>
          {description ? (
            <p className="text-theme-xs text-white/85 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}
