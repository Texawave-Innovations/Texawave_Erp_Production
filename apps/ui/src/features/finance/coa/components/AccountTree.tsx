"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  FinanceAccount,
  FinanceAccountTreeNode,
} from "@texawave-erp/api-types";
import { Button } from "@texawave-erp/ui-kit";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileSpreadsheet,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatMoney } from "../../shared/format";
import { AccountBadge } from "./AccountBadge";

export interface AccountTreeProps {
  nodes: FinanceAccountTreeNode[];
  canWrite: boolean;
  onEdit: (account: FinanceAccount) => void;
  onDelete: (account: FinanceAccount) => void;
  onAddChild: (parent: FinanceAccount) => void;
}

interface TreeNodeItemProps {
  node: FinanceAccountTreeNode;
  level: number;
  canWrite: boolean;
  expandedKeys: Set<number>;
  toggleExpand: (id: number) => void;
  onEdit: (account: FinanceAccount) => void;
  onDelete: (account: FinanceAccount) => void;
  onAddChild: (parent: FinanceAccount) => void;
}

function TreeNodeItem({
  node,
  level,
  canWrite,
  expandedKeys,
  toggleExpand,
  onEdit,
  onDelete,
  onAddChild,
}: TreeNodeItemProps) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedKeys.has(node.id);

  return (
    <div className="flex flex-col">
      <div
        className={`group flex items-center justify-between py-2.5 px-3 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-50/80 dark:hover:border-gray-800 dark:hover:bg-gray-900/60 transition-colors ${
          !node.isActive ? "opacity-60 bg-gray-50/40 dark:bg-gray-950/40" : ""
        }`}
        style={{ paddingLeft: `${Math.max(12, level * 24 + 12)}px` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label={isExpanded ? "Collapse branch" : "Expand branch"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-6 inline-block" />
          )}

          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-sky-400 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500 dark:text-sky-500 shrink-0" />
            )
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
          )}

          <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
            {node.accountCode}
          </span>
          <span className="text-gray-400 dark:text-gray-600">—</span>
          <span className="text-theme-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {node.accountName}
          </span>

          {!node.isActive ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Inactive
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <AccountBadge type={node.accountType} />

          <span className="text-theme-sm font-semibold text-gray-900 dark:text-white min-w-[100px] text-right">
            {formatMoney(node.currentBalance as string | number, node.currency)}
          </span>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <Link
              href={`/finance/general-ledger?accountId=${node.id}`}
              title="View General Ledger"
              className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-sky-400 dark:hover:bg-blue-950/50 transition-colors"
              aria-label={`View ledger for ${node.accountName}`}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </Link>
            {canWrite ? (
              <>
                <button
                  type="button"
                  onClick={() => onAddChild(node)}
                  title="Add sub-account"
                  className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                  aria-label={`Add sub-account under ${node.accountName}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(node)}
                  title="Edit account"
                  className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
                  aria-label={`Edit ${node.accountName}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(node)}
                  title="Deactivate account"
                  className="p-1 rounded-md text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/50 transition-colors"
                  aria-label={`Deactivate ${node.accountName}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="flex flex-col border-l border-gray-100 dark:border-gray-800/80 ml-6 my-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              canWrite={canWrite}
              expandedKeys={expandedKeys}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AccountTree({
  nodes,
  canWrite,
  onEdit,
  onDelete,
  onAddChild,
}: AccountTreeProps) {
  // Recursively collect all node IDs
  const collectAllIds = (items: FinanceAccountTreeNode[]): number[] => {
    let ids: number[] = [];
    for (const item of items) {
      ids.push(item.id);
      if (item.children && item.children.length > 0) {
        ids = ids.concat(collectAllIds(item.children));
      }
    }
    return ids;
  };

  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(() => {
    // Default: expand top 2 levels
    const initial = new Set<number>();
    for (const n of nodes) {
      initial.add(n.id);
      for (const child of n.children ?? []) {
        initial.add(child.id);
      }
    }
    return initial;
  });

  const toggleExpand = (id: number) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(collectAllIds(nodes)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-theme-sm">
        No accounts found in tree hierarchy.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-2 pb-1 border-b border-gray-100 dark:border-gray-800">
        <span className="text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Account Hierarchy & Balances
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {nodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            canWrite={canWrite}
            expandedKeys={expandedKeys}
            toggleExpand={toggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
          />
        ))}
      </div>
    </div>
  );
}
