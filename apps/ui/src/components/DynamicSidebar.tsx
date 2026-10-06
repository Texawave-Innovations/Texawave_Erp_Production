"use client";

import type { MenuTreeNode } from "@texawave-erp/api-types";
import { Skeleton } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMyMenu } from "@/features/menu/hooks";

interface SidebarItemProps {
  item: MenuTreeNode;
  currentPath: string;
}

function SidebarItem({ item, currentPath }: SidebarItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isDirectActive = item.path ? currentPath === item.path : false;
  const isChildActive = hasChildren
    ? item.children.some(
        (child) => child.path && currentPath.startsWith(child.path),
      )
    : false;
  const isActive = isDirectActive || isChildActive;

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors ${
            isActive
              ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          <span className="flex items-center gap-2">
            {item.icon ? <span className="text-base">{item.icon}</span> : null}
            <span>{item.label}</span>
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-gray-200 pl-2 dark:border-gray-800">
            {item.children.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                currentPath={currentPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.path ?? "#"}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors ${
        isDirectActive
          ? "bg-brand-500 text-gray-900 font-semibold shadow-xs"
          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      {item.icon ? <span className="text-base">{item.icon}</span> : null}
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Below `lg` (1024px) the sidebar is an off-canvas drawer that the header
 * button opens; from `lg` up it is the fixed column it has always been, so
 * desktop is unchanged. Literal class strings only (CODING_STANDARDS §12).
 */
function sidebarClass(open: boolean): string {
  return [
    "fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-gray-900",
    "lg:static lg:z-auto lg:flex-shrink-0 lg:translate-x-0 lg:transition-none",
    open ? "translate-x-0" : "invisible -translate-x-full lg:visible",
  ].join(" ");
}

export function DynamicSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const menuQuery = useMyMenu();

  // Following any link closes the drawer on small screens. Keyboard activation
  // also fires a click on the anchor, so this covers both paths.
  const onAsideClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) onNavigate();
  };

  if (menuQuery.isPending) {
    return (
      <aside id="app-sidebar" className={`${sidebarClass(open)} p-4`}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-full" />
        </div>
      </aside>
    );
  }

  if (menuQuery.isError) {
    return (
      <aside
        id="app-sidebar"
        className={`${sidebarClass(open)} p-4 text-theme-xs text-error-600`}
      >
        Could not load navigation.
      </aside>
    );
  }

  const items = menuQuery.data ?? [];

  return (
    <aside
      id="app-sidebar"
      className={sidebarClass(open)}
      onClick={onAsideClick}
    >
      <div className="flex h-full flex-col justify-between p-4">
        <nav className="flex flex-col gap-1.5 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-2 text-theme-xs text-gray-400">
              No navigation items available
            </p>
          ) : (
            items.map((item) => (
              <SidebarItem key={item.id} item={item} currentPath={pathname} />
            ))
          )}
        </nav>
      </div>
    </aside>
  );
}
