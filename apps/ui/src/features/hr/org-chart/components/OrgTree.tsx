"use client";

import type { OrgChartNode } from "../types";
import { OrgNodeCard } from "./OrgNodeCard";

export interface OrgTreeProps {
  nodes: OrgChartNode[];
  matchedIds: Set<number>;
  selectedId?: number | null | undefined;
  collapsedIds: Set<number>;
  onToggleCollapse: (id: number) => void;
  onSelect: (node: OrgChartNode) => void;
  depth?: number | undefined;
}

/**
 * Pure CSS hierarchical organization tree.
 * Renders unbroken manager-to-report connector lines, supporting deep recursive trees,
 * expand/collapse branches, and keyboard accessibility.
 */
export function OrgTree({
  nodes,
  matchedIds,
  selectedId,
  collapsedIds,
  onToggleCollapse,
  onSelect,
  depth = 0,
}: OrgTreeProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <ul
      className={`flex justify-center ${
        depth === 0 ? "flex-wrap gap-12" : "w-full"
      }`}
    >
      {nodes.map((node, index) => {
        const isCollapsed = collapsedIds.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const totalSiblings = nodes.length;

        return (
          <li
            key={node.id}
            className={`relative flex flex-col items-center ${
              depth > 0 ? "px-4" : ""
            }`}
          >
            {/* Top Connector Lines for Children (Depth > 0) */}
            {depth > 0 && totalSiblings > 1 && (
              <div
                className={`absolute top-0 h-px bg-neutral-300 dark:bg-neutral-700 ${
                  index === 0
                    ? "left-1/2 right-0"
                    : index === totalSiblings - 1
                      ? "left-0 right-1/2"
                      : "left-0 right-0"
                }`}
                aria-hidden="true"
              />
            )}

            {/* Vertical drop line down into the node card */}
            {depth > 0 && (
              <div
                className="h-6 w-px bg-neutral-300 dark:bg-neutral-700 shrink-0"
                aria-hidden="true"
              />
            )}

            {/* Employee Node Card */}
            <OrgNodeCard
              node={node}
              isMatched={matchedIds.has(node.id)}
              isSelected={selectedId === node.id}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => onToggleCollapse(node.id)}
              onSelect={() => onSelect(node)}
            />

            {/* Direct Reports Subtree Connectors */}
            {hasChildren && !isCollapsed && (
              <div className="flex flex-col items-center w-full">
                {/* Vertical Trunk Line down from Manager Card */}
                <div
                  className="h-6 w-px bg-neutral-300 dark:bg-neutral-700 shrink-0"
                  aria-hidden="true"
                />

                {/* Recursive Children Tree */}
                <OrgTree
                  nodes={node.children}
                  matchedIds={matchedIds}
                  selectedId={selectedId}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
