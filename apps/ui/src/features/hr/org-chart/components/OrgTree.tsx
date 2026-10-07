"use client";

import { cn } from "@texawave-erp/ui-kit";
import type { OrgChartNode } from "../types";
import { OrgNodeCard } from "./OrgNodeCard";

interface OrgTreeProps {
  nodes: OrgChartNode[];
  matchedIds: Set<number>;
  collapsedIds: Set<number>;
  onToggleCollapse: (id: number) => void;
  onSelect: (node: OrgChartNode) => void;
  depth?: number;
}

/**
 * Recursive `<ul>/<li>` layout with CSS-border connectors (no canvas/SVG,
 * no chart library) — the same family of approach the legacy org chart
 * used, rebuilt on production design tokens instead of its bespoke
 * gradients.
 */
export function OrgTree({
  nodes,
  matchedIds,
  collapsedIds,
  onToggleCollapse,
  onSelect,
  depth = 0,
}: OrgTreeProps) {
  return (
    <ul
      className={cn(
        "flex gap-6",
        depth === 0
          ? "flex-wrap"
          : "border-t border-gray-200 pt-6 dark:border-gray-800",
      )}
    >
      {nodes.map((node) => {
        const isCollapsed = collapsedIds.has(node.id);
        const hasChildren = node.children.length > 0;
        return (
          <li key={node.id} className="flex flex-col items-center">
            <OrgNodeCard
              node={node}
              isMatched={matchedIds.has(node.id)}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => onToggleCollapse(node.id)}
              onSelect={() => onSelect(node)}
            />
            {hasChildren && !isCollapsed ? (
              <div className="mt-4 flex flex-col items-center">
                <span className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
                <OrgTree
                  nodes={node.children}
                  matchedIds={matchedIds}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
