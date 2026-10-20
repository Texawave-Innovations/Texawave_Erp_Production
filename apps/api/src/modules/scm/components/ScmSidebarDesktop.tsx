import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCM_NAV, isScmNavGroup } from "../nav";

interface FlyoutState {
  groupId: string;
  top: number;
  left: number;
}

/**
 * Full-height, collapsible SCM sidebar for desktop (`sm:` and up) — white theme, tree-line
 * submenus when expanded, and an icon rail with a flyout panel per group when collapsed. Mirrors
 * the reference design's two states; the mobile drawer keeps using the simpler `ScmSidebar` list
 * instead of this component.
 */
export default function ScmSidebarDesktop() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const activeGroupId =
    SCM_NAV.find(
      (item) =>
        isScmNavGroup(item) &&
        item.children.some((c) => location.pathname.startsWith(c.path)),
    )?.id ?? null;

  // Starts open on whichever group contains the route present at mount (e.g. landing on a group's
  // page directly, or via a Quick Action link) and otherwise follows the user's own clicks below —
  // computed synchronously as the initial state so it's correct on the very first paint, instead of
  // an effect that applied it a render late and produced a visible expand/collapse jump on load.
  const [openGroupId, setOpenGroupId] = useState<string | null>(
    () => activeGroupId,
  );

  useEffect(() => {
    setFlyout(null);
  }, [collapsed, location.pathname]);

  useEffect(() => {
    if (!flyout) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insideFlyout = flyoutRef.current?.contains(target);
      if (!insideTrigger && !insideFlyout) setFlyout(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [flyout]);

  const openFlyout = (groupId: string, trigger: HTMLElement) => {
    setFlyout((prev) => {
      if (prev?.groupId === groupId) return null;
      const rect = trigger.getBoundingClientRect();
      return { groupId, top: rect.top, left: rect.right + 8 };
    });
  };

  const flyoutGroup = flyout
    ? SCM_NAV.find((i) => i.id === flyout.groupId)
    : null;

  return (
    <aside
      ref={rootRef}
      className={cn(
        "relative flex h-full flex-col bg-white border-r border-slate-200",
        "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "w-16" : "w-[240px]",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-5 z-10 grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm outline-none transition-colors hover:border-brand-200 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300"
        aria-label={collapsed ? "Expand SCM menu" : "Collapse SCM menu"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      <nav className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-2.5 py-5">
        <ul className="space-y-1">
          {SCM_NAV.map((item) => {
            const Icon = item.icon;

            if (!isScmNavGroup(item)) {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl text-[14px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-300",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                      isActive
                        ? "border border-brand-200 bg-brand-50 font-semibold text-brand-700 shadow-xs"
                        : "border border-transparent text-gray-600 hover:bg-brand-50/70 hover:text-brand-600",
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              );
            }

            const groupIsActive = item.children.some((c) =>
              location.pathname.startsWith(c.path),
            );

            if (collapsed) {
              const isFlyoutOpen = flyout?.groupId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    title={item.label}
                    onClick={(e) => openFlyout(item.id, e.currentTarget)}
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl py-2.5 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-300",
                      groupIsActive || isFlyoutOpen
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-600 hover:bg-brand-50/70 hover:text-brand-600",
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                  </button>
                </li>
              );
            }

            const isOpen = openGroupId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroupId((prev) =>
                      prev === item.id ? null : item.id,
                    )
                  }
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-300",
                    isOpen || groupIsActive
                      ? "bg-brand-50/70 text-brand-700 font-semibold"
                      : "text-gray-600 hover:bg-brand-50/70 hover:text-brand-600",
                  )}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="flex-1 truncate text-left">
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <ul className="mt-0.5 ml-[22px] pl-3">
                    {item.children.map((child, idx, arr) => {
                      const ChildIcon = child.icon;
                      const isActive = child.exact
                        ? location.pathname === child.path
                        : location.pathname.startsWith(child.path);
                      const isLast = idx === arr.length - 1;
                      return (
                        <li key={child.id} className="relative">
                          {/* Elbow connector, split into two pieces so the vertical line stays
                              unbroken between rows (no gap at each row boundary) while still
                              stopping cleanly after the last child instead of running past it:
                              the elbow itself (top half, curving into this row's icon)... */}
                          <span
                            className="absolute -left-[13px] top-0 h-1/2 w-[13px] rounded-bl-[6px] border-b border-l border-slate-400"
                            aria-hidden
                          />
                          {/* ...and a straight continuation (bottom half) linking down to the
                              next row's elbow — omitted on the last child. */}
                          {!isLast && (
                            <span
                              className="absolute -left-[13px] top-1/2 h-1/2 w-px bg-slate-400"
                              aria-hidden
                            />
                          )}
                          <NavLink
                            to={child.path}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-300",
                              isActive
                                ? "border border-brand-200 bg-brand-50 font-semibold text-brand-700"
                                : "border border-transparent text-gray-500 hover:bg-brand-50/70 hover:text-brand-600",
                            )}
                          >
                            <ChildIcon
                              className={cn(
                                "h-[15px] w-[15px] shrink-0",
                                item.id === "inventory-warehouse" &&
                                  "text-brand-600",
                              )}
                            />
                            <span className="truncate">{child.label}</span>
                            {isActive && (
                              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapsed-state flyout — portaled to `document.body`. A `position: fixed` element stays
          fixed to the true viewport only when none of its ancestors have a transform; portaling
          sidesteps having to guarantee that for every ancestor here. */}
      {flyout &&
        flyoutGroup &&
        isScmNavGroup(flyoutGroup) &&
        createPortal(
          <div
            ref={flyoutRef}
            style={{ position: "fixed", top: flyout.top, left: flyout.left }}
            className="z-50 w-[210px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
          >
            <p className="truncate px-2.5 py-1.5 text-[13px] font-semibold text-slate-800">
              {flyoutGroup.label}
            </p>
            <ul className="ml-[9px] mt-0.5 pl-3">
              {flyoutGroup.children.map((child, idx, arr) => {
                const ChildIcon = child.icon;
                const isActive = child.exact
                  ? location.pathname === child.path
                  : location.pathname.startsWith(child.path);
                const isLast = idx === arr.length - 1;
                return (
                  <li key={child.id} className="relative">
                    <span
                      className="absolute -left-[13px] top-0 h-1/2 w-[13px] rounded-bl-[6px] border-b border-l border-slate-400"
                      aria-hidden
                    />
                    {!isLast && (
                      <span
                        className="absolute -left-[13px] top-1/2 h-1/2 w-px bg-slate-400"
                        aria-hidden
                      />
                    )}
                    <NavLink
                      to={child.path}
                      onClick={() => setFlyout(null)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-300",
                        isActive
                          ? "border border-brand-200 bg-brand-50 font-semibold text-brand-700"
                          : "border border-transparent text-gray-500 hover:bg-brand-50/70 hover:text-brand-600",
                      )}
                    >
                      <ChildIcon
                        className={cn(
                          "h-[15px] w-[15px] shrink-0",
                          flyoutGroup.id === "inventory-warehouse" &&
                            "text-brand-600",
                        )}
                      />
                      <span className="truncate">{child.label}</span>
                      {isActive && (
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </aside>
  );
}
