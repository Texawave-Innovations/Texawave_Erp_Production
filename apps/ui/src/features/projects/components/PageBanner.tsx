import type { ComponentType, ReactNode, SVGProps } from "react";

interface PageBannerProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

/** Shared gradient header banner for Projects module pages. */
export function PageBanner({
  icon: Icon,
  eyebrow = "Enterprise Operations",
  title,
  description,
  actions,
}: PageBannerProps) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-500/15 dark:border-blue-900/40">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 right-16 h-48 w-48 rounded-full bg-blue-300/25 blur-3xl"
      />

      <div className="relative flex items-center gap-4">
        <div className="rounded-2xl bg-white/20 p-3.5 shadow-inner backdrop-blur-md">
          <Icon className="h-7 w-7 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          <p className="text-sm font-medium text-cyan-100/90">{description}</p>
        </div>
      </div>

      {actions ? (
        <div className="relative flex flex-wrap items-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
