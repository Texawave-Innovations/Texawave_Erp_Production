"use client";

import { Card, Skeleton, StatusBadge } from "@texawave-erp/ui-kit";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useMomDocumentsByProject } from "../hooks";

export interface ProjectMomHistoryProps {
  projectId: number;
}

/** Meeting History section embedded on the project detail page — legacy
 * `ProjectDetail.tsx`'s MoM-history block. */
export function ProjectMomHistory({ projectId }: ProjectMomHistoryProps) {
  const query = useMomDocumentsByProject(projectId);
  const count = query.data?.length ?? 0;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Meeting History (MoM)
            </h2>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-cyan-300">
              {count} {count === 1 ? "Record" : "Records"}
            </span>
          </div>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            Official minutes of meeting records, deliberations, decisions, and
            action items for this project.
          </p>
        </div>
        <Link
          href={`/projects/mom/create?projectId=${projectId}`}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-colors hover:brightness-105"
        >
          <Plus className="h-3.5 w-3.5" />
          Record Meeting Minutes
        </Link>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : query.isError ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Could not load meeting history.
        </p>
      ) : query.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ClipboardList className="h-8 w-8 text-gray-300 dark:text-gray-700" />
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            No meeting minutes recorded for this project yet.
          </p>
          <Link
            href={`/projects/mom/create?projectId=${projectId}`}
            className="text-theme-xs font-semibold text-brand-600 hover:underline dark:text-cyan-400"
          >
            + Click here to create first meeting record
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.map((mom) => (
            <li
              key={mom.id}
              className="flex items-center justify-between text-theme-sm"
            >
              <Link
                href={`/projects/mom/${mom.id}`}
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {mom.meetingTitle}
              </Link>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span>{mom.meetingDate}</span>
                <StatusBadge
                  label={mom.status}
                  colorToken={
                    mom.status === "finalized"
                      ? "success"
                      : mom.status === "archived"
                        ? "gray"
                        : "warning"
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
