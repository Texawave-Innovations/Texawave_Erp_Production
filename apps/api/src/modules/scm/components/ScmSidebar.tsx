import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCM_NAV, isScmNavGroup } from "../nav";

/**
 * Dedicated SCM secondary sidebar — SCM's nav tree (~40 leaves across 9 groups) is far deeper than
 * any other module's, so unlike CRM's horizontal tab bar this uses a collapsible vertical list
 * (same visual language as the global Sidebar: brand-50 active state, rounded-xl items, same
 * spacing/typography) rendered inside the SCM content area, next to the global app sidebar.
 */
export default function ScmSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const location = useLocation();

  const activeGroupId = SCM_NAV.find(
    (item) =>
      isScmNavGroup(item) &&
      item.children.some((c) => location.pathname.startsWith(c.path)),
  )?.id;

  // Tracks only the user's own manual expand/collapse clicks. The group containing the current
  // route is unioned in below at render time (not synced in via an effect) so navigating straight
  // to a route — e.g. via a Quick Action link — expands its group on the very first paint instead
  // of a render late, which was showing as a visible expand jump right after navigating.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <nav className="w-[228px] shrink-0 h-full overflow-y-auto overscroll-contain no-scrollbar border-r border-slate-200 bg-white py-3 px-2.5">
      <ul className="space-y-1">
        {SCM_NAV.map((item) => {
          const Icon = item.icon;

          if (!isScmNavGroup(item)) {
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                      isActive
                        ? "bg-brand-50 text-brand-700 font-semibold border border-brand-200 shadow-xs"
                        : "text-gray-600 hover:bg-brand-50/70 hover:text-brand-600 border border-transparent",
                    )
                  }
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          }

          const isOpen =
            item.id === activeGroupId
              ? openGroups[item.id] !== false
              : !!openGroups[item.id];
          const groupIsActive = item.children.some((c) =>
            location.pathname.startsWith(c.path),
          );

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [item.id]: !isOpen }))
                }
                aria-expanded={isOpen}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                  groupIsActive
                    ? "text-brand-700 font-semibold"
                    : "text-gray-600 hover:bg-brand-50/70 hover:text-brand-600",
                )}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <ul className="mt-0.5 ml-[22px] pl-2.5 border-l border-slate-200 space-y-0.5">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <li key={child.id}>
                        <NavLink
                          to={child.path}
                          // A group's Dashboard leaf (e.g. `/scm/procurement`) is a path prefix of
                          // its siblings — match it exactly so only one item is highlighted.
                          end={
                            child.exact ||
                            item.children.some((c) =>
                              c.path.startsWith(`${child.path}/`),
                            )
                          }
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-all duration-200",
                              isActive
                                ? "bg-brand-50 text-brand-700 font-semibold border border-brand-200"
                                : "text-gray-500 hover:bg-brand-50/70 hover:text-brand-600 border border-transparent",
                            )
                          }
                        >
                          <ChildIcon className="h-[15px] w-[15px] shrink-0" />
                          <span className="truncate">{child.label}</span>
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
  );
}
