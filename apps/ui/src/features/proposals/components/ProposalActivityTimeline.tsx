"use client";

import type { ProposalActivity, ProposalStatus } from "@texawave-erp/api-types";
import { History } from "lucide-react";
import { PROPOSAL_STATUS_META, WORKFLOW_ACTION_META } from "../utils";

const EXTRA_ACTION_LABELS: Record<string, string> = {
  created: "Created",
  followup_extended: "Follow-up date updated",
};

function actionLabel(action: string): string {
  return (
    EXTRA_ACTION_LABELS[action] ??
    (WORKFLOW_ACTION_META as Record<string, { label: string } | undefined>)[
      action
    ]?.label ??
    action.replace(/_/g, " ")
  );
}

function statusLabel(status: string | null): string | null {
  if (!status) return null;
  return PROPOSAL_STATUS_META[status as ProposalStatus]?.label ?? status;
}

/** Legacy hub "Workflow & Audit History" timeline — one entry per
 * `ProposalActivity` row, newest first. */
export function ProposalActivityTimeline({
  activities,
}: {
  activities: ProposalActivity[];
}) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
        No activity events logged yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {activities.map((a) => {
        const from = statusLabel(a.previousStatus);
        const to = statusLabel(a.newStatus);
        return (
          <li
            key={a.id}
            className="flex gap-3 border-l-2 border-brand-200 pl-3 dark:border-brand-800"
          >
            <History className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {actionLabel(a.action)}
                {a.userName ? (
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    {" "}
                    — {a.userName}
                  </span>
                ) : null}
              </p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {new Date(a.createdAt).toLocaleString("en-IN")}
                {from && to ? ` · ${from} → ${to}` : to ? ` · ${to}` : ""}
              </p>
              {a.comments ? (
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-theme-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {a.comments}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
