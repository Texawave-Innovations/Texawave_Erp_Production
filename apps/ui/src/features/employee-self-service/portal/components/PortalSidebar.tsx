"use client";

import { Skeleton } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPortalNavItemActive, usePortalNavGroups } from "../nav";

/**
 * Employee portal sidebar: a solid brand-blue column of always-open,
 * uppercase-labelled groups (OVERVIEW, ATTENDANCE, LEAVES, WORK & PROJECTS,
 * EXPENSES, PAYROLL, MY INFO) with a user card pinned to the bottom.
 *
 * The active item is a "tab" cut out of the column: it takes the content
 * area's own background (`gray-50` / `gray-dark`, set solid on `<main>` in
 * the portal layout so the two match exactly) and runs flush to the right
 * edge, with two inverted corners (`before`/`after` box-shadow curves) so it
 * reads as one piece with the page. In the small-screen drawer there is no
 * page beside it to join, so the active item is a plain rounded pill there.
 *
 * The column's right-hand corners are rounded so it doesn't end in a hard
 * edge against the header and the bottom of the screen. The list fades out
 * at the bottom while there is more below and at the top once scrolled down
 * (the scrollbar itself is hidden — see the nav below). Each fade is an
 * overlay painted with the column's own gradient, sized to the whole column
 * and offset to where the overlay sits, so it matches the colour behind it
 * exactly; items — the white active tab included — slide *under* it instead
 * of turning see-through (a mask on the list left a pale haze there).
 *
 * Colour: the navbar's active-tab pill gradient (`.tab-prime-pill` in
 * packages/ui-kit/src/theme.css), run top to bottom — the same lighter brand
 * blue as the module tabs, light and dark variants alike.
 */

/**
 * Inverted-corner curves above and below the active tab: a transparent
 * 28px square whose box-shadow (offset = spread = radius / 4) paints the
 * area outside its rounded corner in the page colour.
 */
/** The column background, shared with the fade overlays so they match it. */
const SIDEBAR_BG =
  "bg-linear-to-b from-[#469ff6] via-[#2a80e8] to-[#2067d2] dark:from-[#0284c7] dark:via-[#1769f5] dark:to-[#1d4ed8]";

/** Fade heights (px): top once scrolled, bottom while more is below. */
const FADE_TOP = 48;
const FADE_BOTTOM = 56;

const NOTCH =
  "relative ml-3 rounded-l-full " +
  "before:pointer-events-none before:absolute before:right-0 before:-top-7 before:h-7 before:w-7 before:rounded-br-[28px] before:shadow-[7px_7px_0_7px_var(--color-gray-50)] " +
  "after:pointer-events-none after:absolute after:right-0 after:-bottom-7 after:h-7 after:w-7 after:rounded-tr-[28px] after:shadow-[7px_-7px_0_7px_var(--color-gray-50)] " +
  "dark:before:shadow-[7px_7px_0_7px_var(--color-gray-dark)] dark:after:shadow-[7px_-7px_0_7px_var(--color-gray-dark)]";

function overflowOf(el: HTMLElement) {
  return {
    above: el.scrollTop > 1,
    below: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
  };
}

export function PortalSidebar({
  open,
  onNavigate,
  name,
  initials,
}: {
  open: boolean;
  onNavigate: () => void;
  name: string;
  initials: string;
}) {
  const pathname = usePathname();
  const { groups, isPending, isError } = usePortalNavGroups();

  // Whether the list continues above / below what's visible. Updated on
  // scroll and from a ResizeObserver on both the viewport (window resize) and
  // the content (menu loads/changes); the observer's first callback sets the
  // initial value.
  // The column and list-area heights size the overlays' gradient to match.
  const asideRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ above: false, below: false });
  const [heights, setHeights] = useState({ aside: 0, area: 0 });
  const measure = () => {
    const el = navRef.current;
    if (el) setOverflow(overflowOf(el));
  };
  useEffect(() => {
    const aside = asideRef.current;
    const area = areaRef.current;
    const el = navRef.current;
    const list = listRef.current;
    if (!aside || !area || !el || !list) return;
    const observer = new ResizeObserver(() => {
      setOverflow(overflowOf(el));
      setHeights({ aside: aside.clientHeight, area: area.clientHeight });
    });
    for (const node of [aside, area, el, list]) observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const fadeBackground = (offset: number) => ({
    backgroundSize: `100% ${heights.aside}px`,
    backgroundPosition: `0 ${-offset}px`,
  });

  return (
    <aside
      ref={asideRef}
      id="app-sidebar"
      className={`w-56 shrink-0 flex-col overflow-hidden rounded-r-3xl ${SIDEBAR_BG} ${
        open ? "fixed inset-y-0 left-0 z-40 flex shadow-2xl" : "hidden lg:flex"
      }`}
    >
      <div ref={areaRef} className="relative flex min-h-0 flex-1 flex-col">
        <nav
          ref={navRef}
          onScroll={measure}
          aria-label="My Portal Navigation"
          // Scrollbar hidden (still scrolls by wheel, touch and keyboard focus):
          // a visible bar sits between the active tab and the page and breaks
          // the join.
          className="min-h-0 flex-1 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={listRef}>
            {isPending ? (
              <div className="flex flex-col gap-3 p-3">
                <Skeleton className="h-6 w-full bg-white/20" />
                <Skeleton className="h-6 w-full bg-white/20" />
                <Skeleton className="h-6 w-4/5 bg-white/20" />
              </div>
            ) : isError ? (
              <p className="p-3 text-theme-xs font-semibold text-white">
                Could not load navigation.
              </p>
            ) : (
              groups.map((group, gi) => (
                <div key={group.label}>
                  <p
                    className={`mb-1 px-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80 ${
                      gi === 0 ? "mt-2" : "mt-4"
                    }`}
                  >
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const active = isPortalNavItemActive(item, pathname);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`group my-0.5 flex items-center gap-2.5 px-4 py-2.5 text-theme-xs transition-colors duration-200 ease-out ${
                          active
                            ? `${open ? "mx-3 rounded-xl" : NOTCH} bg-gray-50 font-semibold text-brand-600 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:bg-gray-dark dark:text-sky-300`
                            : "mx-3 rounded-xl font-medium text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white active:bg-white/20"
                        }`}
                      >
                        <item.icon
                          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110"
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </nav>
        {/* Edge fades: the column's gradient (aligned to the column) fading
            out over a light blur, opaque at the very edge. */}
        <div
          aria-hidden="true"
          style={{ height: FADE_TOP, ...fadeBackground(0) }}
          className={`pointer-events-none absolute inset-x-0 top-0 ${SIDEBAR_BG} backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,black_25%,transparent)] transition-opacity duration-200 ${
            overflow.above ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden="true"
          style={{
            height: FADE_BOTTOM,
            ...fadeBackground(heights.area - FADE_BOTTOM),
          }}
          className={`pointer-events-none absolute inset-x-0 bottom-0 ${SIDEBAR_BG} backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_25%,transparent)] transition-opacity duration-200 ${
            overflow.below ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* Bottom user card */}
      <div className="shrink-0 border-t border-white/15 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-[10px] font-bold text-brand-600">
              {initials}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-theme-xs font-semibold text-white">
              {name}
            </p>
            <p className="text-[10px] text-white/80">Employee</p>
          </div>
          <span
            aria-hidden="true"
            className="ml-auto block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400"
          />
        </div>
      </div>
    </aside>
  );
}
