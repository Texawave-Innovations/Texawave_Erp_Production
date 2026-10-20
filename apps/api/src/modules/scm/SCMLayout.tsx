import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft, Boxes, ChevronRight, Menu, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import ScmSidebar from "./components/ScmSidebar";
import ScmSidebarDesktop from "./components/ScmSidebarDesktop";
import ScmAiChatbot from "./ai/components/ScmAiChatbot";
import { SCM_NAV, isScmNavGroup } from "./nav";

function matchedGroupChild(pathname: string) {
  for (const item of SCM_NAV) {
    if (!isScmNavGroup(item)) continue;
    const matches = item.children.filter((c) => pathname.startsWith(c.path));
    if (matches.length === 0) continue;
    const child = matches.reduce((best, c) =>
      c.path.length > best.path.length ? c : best,
    );
    return { group: item, child };
  }
  return null;
}

function currentBreadcrumb(pathname: string): string {
  let best: { path: string; label: string } | null = null;
  for (const item of SCM_NAV) {
    const candidates = isScmNavGroup(item)
      ? item.children.map((c) => ({
          path: c.path,
          label: `${item.label} → ${c.label}`,
        }))
      : [{ path: item.path, label: item.label }];
    for (const c of candidates) {
      if (
        pathname.startsWith(c.path) &&
        (!best || c.path.length > best.path.length)
      )
        best = c;
    }
  }
  return best?.label ?? "Overview";
}

/** Every group's first child is its "home" leaf (a Dashboard/Overview page, or — for groups that
 * don't have one — simply the first item listed). Sub-pages within a group only had the sidebar
 * to get back to that home leaf; this gives every one of them an explicit, consistent way back.
 * Detail routes with a dynamic id/code segment (e.g. `/scm/returns/:id`) are excluded — those
 * already carry their own more specific "← Back to X" button pointing at the exact right list. */
function backTarget(pathname: string): { label: string; path: string } | null {
  const match = matchedGroupChild(pathname);
  if (!match) return null;
  const { group, child } = match;
  const isExactMatch = pathname === child.path;
  const isGroupHome = child.id === group.children[0].id;
  if (!isExactMatch || isGroupHome) return null;
  return { label: group.label, path: group.children[0].path };
}

const OVERVIEW_PATH = "/scm/overview";

export default function SCMLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const back = backTarget(location.pathname);
  // Overview is the module's true home — every other page gets a way back to it, in addition to
  // (not instead of) the group-level back above: a page like GRN shows "Overview / Procurement",
  // while a group's own home page (which has no group-back target) still shows "Overview" alone —
  // that second case was the actual gap: clicking a stage card on Overview (e.g. into Inventory's
  // Stock Overview, or Orders' Sales Orders) landed on a page with no way back at all.
  const showOverviewBack = location.pathname !== OVERVIEW_PATH;

  return (
    <Layout
      aside={
        // Rendered as `main`'s own flex sibling (see `Layout`'s `aside` prop) instead of inside
        // it, so it gets a genuinely independent height/scroll instead of relying on `position:
        // sticky` inside the scrolling page column — which broke intermittently whenever anything
        // upstream of it in that column picked up a CSS `transform` (an entrance animation, a
        // hover effect, etc. — transforms always break sticky/fixed descendants). Hidden below
        // `sm`; the mobile drawer further down covers that case.
        <div className="hidden sm:block h-full shrink-0">
          <ScmSidebarDesktop />
        </div>
      }
    >
      {/* `scm-scope` scopes the stronger card shadow/border in index.css to this module only —
          the shared Card component's default shadow is barely visible (6% opacity) against the
          near-white page background app-wide, which reads as boxes with no clearance from the
          page; this makes SCM's cards visibly separated without changing that shared component
          or any other module's look. The sidebar that used to share this flex row now renders via
          `Layout`'s `aside` slot above instead (see the comment there). */}
      <div className="scm-scope">
        <div className="min-w-0 space-y-6 pb-10">
          {/* Header — same premium gradient treatment as the CRM header (soft brand/blue radial
              blur over white), only the icon/title/subtitle change. */}
          <div className="relative overflow-hidden rounded-3xl border border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4 flex items-center justify-between gap-3">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
            />
            <div className="relative flex min-w-0 items-center gap-3">
              {/* Below `sm` the full-height sidebar above is hidden (no room for it next to page
                  content at phone widths) — this opens it as a drawer instead. */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-200/60 bg-white/80 text-foreground shadow-sm sm:hidden"
                aria-label="Open SCM sections"
              >
                <Menu className="h-4 w-4" />
              </button>
              <span className="p-3 bg-gradient-to-br from-brand-400 to-brand-600 text-white rounded-2xl shadow-lg shadow-brand-500/25 shrink-0">
                <Boxes className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  SCM
                </h1>
                <p className="text-muted-foreground mt-1 truncate">
                  End-to-end supply chain management
                </p>
              </div>
            </div>
            <div className="relative hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>SCM</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {currentBreadcrumb(location.pathname)}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              {(showOverviewBack || back) && (
                <div className="-mt-2 mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {showOverviewBack && (
                    <button
                      type="button"
                      onClick={() => navigate(OVERVIEW_PATH)}
                      className="flex items-center gap-1.5 outline-none transition-colors hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300 rounded-md"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Overview
                    </button>
                  )}
                  {showOverviewBack && back && (
                    <span className="text-slate-300">/</span>
                  )}
                  {back && (
                    <button
                      type="button"
                      onClick={() => navigate(back.path)}
                      className="outline-none transition-colors hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300 rounded-md"
                    >
                      {back.label}
                    </button>
                  )}
                </div>
              )}
              <Outlet />
            </Suspense>
          </div>

          {/* Mobile SCM sections drawer — reuses ScmSidebar as-is; only the container around it is
            new. Tapping a section link or the backdrop closes it. Portaled to `document.body` so
            it's positioned against the true viewport regardless of any ancestor's CSS, rather than
            relying on none of them ever picking up a `transform` (which would otherwise silently
            change what a `fixed` descendant is positioned relative to). */}
          {mobileNavOpen &&
            createPortal(
              <div className="fixed inset-0 z-50 flex sm:hidden">
                <button
                  type="button"
                  aria-label="Close SCM sections"
                  className="flex-1 bg-black/40"
                  onClick={() => setMobileNavOpen(false)}
                />
                <div className="flex h-full w-[260px] max-w-[85vw] flex-col bg-white shadow-xl">
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-3">
                    <span className="font-semibold text-foreground">
                      SCM Sections
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen(false)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-slate-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <ScmSidebar onNavigate={() => setMobileNavOpen(false)} />
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>

      {/* Additive-only SCM AI Copilot — floating widget, read-only, permission-scoped by this
          layout's own `ProtectedRoute module="scm"` wrapper in App.tsx. Touches no existing
          SCM business logic, route, or page. */}
      <ScmAiChatbot />
    </Layout>
  );
}
