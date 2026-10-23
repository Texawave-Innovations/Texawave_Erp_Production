"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Semantic3DIcon, type Icon3DName } from "@texawave-erp/ui-kit";

export interface WizardStep {
  number: number | string;
  label: string;
}

export interface ExecutiveHeroBannerProps {
  /** Page title */
  title?: string;
  /** Subtitle or explanatory description */
  subtitle?: string;
  /** Target link for breadcrumb back navigation */
  backHref?: string;
  /** Label for breadcrumb back link */
  backLabel?: string;
  /** Pill badge or status text next to title */
  badge?: ReactNode;
  /** 3D Semantic Icon name shown in right hero box */
  icon3d?: Icon3DName;
  /** Alt text for 3D Icon */
  iconAlt?: string;
  /** Optional multi-step wizard roadmap items */
  steps?: WizardStep[];
  /** Action buttons (e.g. Profile, Edit, Download PDF) */
  actions?: ReactNode;
  /** Identity item (e.g. EmployeeIdentity avatar + details) */
  identity?: ReactNode;
  /** Meta information row (e.g. date joined, location, team) */
  details?: ReactNode;
  /** Custom extra content */
  children?: ReactNode;
  className?: string;
}

/**
 * Standard Executive Hero Banner for enterprise HR pages.
 * Features TexaOne Prime Blue light-contrast gradient, crisp borders,
 * dimensional 3D vector graphics, breadcrumbs, status pill tags, and wizard roadmaps.
 */
export function ExecutiveHeroBanner({
  title,
  subtitle,
  backHref,
  backLabel,
  badge,
  icon3d,
  iconAlt,
  steps,
  actions,
  identity,
  details,
  children,
  className = "",
}: ExecutiveHeroBannerProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Breadcrumb Navigation */}
      {backHref && backLabel ? (
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backLabel}</span>
          </Link>
        </div>
      ) : null}

      {/* Main Hero Card Container */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Content / Identity Area */}
          <div className="flex items-start gap-4 min-w-0">
            {identity}
            <div className="flex flex-col gap-1 min-w-0">
              {title ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="wrap-break-word text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                    {title}
                  </h1>
                  {badge ? (
                    typeof badge === "string" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/80 px-3 py-0.5 text-[11px] font-bold text-brand-500 shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                        {badge}
                      </span>
                    ) : (
                      badge
                    )
                  ) : null}
                </div>
              ) : null}

              {subtitle ? (
                <p className="max-w-2xl text-[12px] font-medium text-[#2f6396] dark:text-sky-300/80">
                  {subtitle}
                </p>
              ) : null}

              {details ? (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#2f6396] dark:text-sky-300/80">
                  {details}
                </div>
              ) : null}

              {children}
            </div>
          </div>

          {/* Right Action / 3D Icon Area */}
          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {icon3d ? (
              <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_4px_16px_rgba(23,105,245,0.12)] ring-2 ring-white/70 dark:border-slate-700 dark:bg-slate-800">
                <Semantic3DIcon
                  name={icon3d}
                  size={36}
                  {...(iconAlt || title ? { alt: iconAlt || title } : {})}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Optional Multi-Step Wizard Roadmap */}
        {steps && steps.length > 0 ? (
          <div className="mt-5 pt-4 border-t border-sky-200/90 dark:border-slate-700 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-[#2f6396] dark:text-sky-300/70">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">
                    {step.number}
                  </span>
                  <span>{step.label}</span>
                </span>
                {idx < steps.length - 1 ? (
                  <span className="text-sky-300 dark:text-slate-600 font-bold">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
