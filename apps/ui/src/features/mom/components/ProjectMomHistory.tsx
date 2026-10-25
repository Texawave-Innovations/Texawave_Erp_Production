"use client";

import { Card, Skeleton, StatusBadge } from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useMomDocumentsByProject } from "../hooks";

export interface ProjectMomHistoryProps {
  projectId: number;
}

/** Meeting History section embedded on the project detail page — legacy
 * `ProjectDetail.tsx`'s MoM-history block. */
export function ProjectMomHistory({ projectId }: ProjectMomHistoryProps) {
  const query = useMomDocumentsByProject(projectId);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Meeting History
        </h2>
        <Link
          href={`/projects/mom/create?projectId=${projectId}`}
          className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          New MoM
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
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No meetings recorded for this project yet.
        </p>
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
