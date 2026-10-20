"use client";

import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { SCM_CATEGORIES } from "@/components/layout/HorizontalNavbar";
import { ScmPanelHost } from "../shared/ScmPanel";

/** Every SCM page with its label, from the same list the top navigation is
 * built from, so the breadcrumb and the menu never disagree. */
const SCM_PAGES: ReadonlyArray<{
  path: string;
  label: string;
  group?: string;
}> = SCM_CATEGORIES.flatMap((cat) =>
  cat.children
    ? cat.children.map((c) => ({
        path: c.path,
        label: c.label,
        group: cat.label,
      }))
    : cat.path
      ? [{ path: cat.path, label: cat.label }]
      : [],
);

/** Title banner shown above every /scm/* page. Navigation lives in the top
 * bar's SCM menu (no side menu); the breadcrumb names the current page. */
export function ScmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The deepest matching page wins (/scm/procurement/rfqs is "RFQs", not the
  // Procurement dashboard that shares its prefix).
  const current = useMemo(() => {
    let best: { path: string; label: string; group?: string } | null = null;
    for (const page of SCM_PAGES) {
      if (
        (pathname === page.path || pathname.startsWith(`${page.path}/`)) &&
        (!best || page.path.length > best.path.length)
      ) {
        best = page;
      }
    }
    return best;
  }, [pathname]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-3xl border border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4 dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 p-3 text-white shadow-lg shadow-brand-500/25">
            <Package className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white/90">
              SCM
            </h1>
            <p className="mt-0.5 text-gray-500 dark:text-gray-400">
              End-to-end supply chain management
            </p>
          </div>
        </div>
        <nav
          aria-label="Breadcrumb"
          className="relative flex items-center gap-1.5 text-theme-sm"
        >
          <Link
            href="/scm/overview"
            className="text-gray-500 hover:text-brand-700 dark:text-gray-400"
          >
            SCM
          </Link>
          {current ? (
            <>
              <ChevronRight
                className="h-3.5 w-3.5 text-gray-400"
                aria-hidden="true"
              />
              {current.group && current.group !== current.label ? (
                <>
                  <span className="text-gray-500 dark:text-gray-400">
                    {current.group}
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5 text-gray-400"
                    aria-hidden="true"
                  />
                </>
              ) : null}
              <span className="font-semibold text-gray-900 dark:text-white/90">
                {current.label}
              </span>
            </>
          ) : null}
        </nav>
      </div>
      <ScmPanelHost>{children}</ScmPanelHost>
    </div>
  );
}
