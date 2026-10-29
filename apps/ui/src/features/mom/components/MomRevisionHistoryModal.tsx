"use client";

import type { MomDocument } from "@texawave-erp/api-types";
import { Button, Dialog, Tabs } from "@texawave-erp/ui-kit";
import { ChevronDown, ChevronRight, GitBranch, History } from "lucide-react";
import { useState } from "react";
import { toSheetData, type MomRevisionSnapshot } from "../utils";
import { MomDocumentSheet } from "./MomDocumentSheet";

type Tab = "revisions" | "audit";

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  saved_draft: "Saved",
  finalized: "Finalized",
  revision_started: "Revision started",
  revised_version_finalized: "Revised version finalized",
  archived: "Archived",
  restored: "Restored",
};

export interface MomRevisionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  document: MomDocument | null;
}

/** Legacy `mom/components/MomRevisionHistoryModal.tsx` — superseded
 * revisions (each a frozen snapshot, viewable in full) and the complete
 * audit trail of lifecycle events. */
export function MomRevisionHistoryModal({
  open,
  onClose,
  document,
}: MomRevisionHistoryModalProps) {
  const [tab, setTab] = useState<Tab>("revisions");
  const [expanded, setExpanded] = useState<number | null>(null);

  const revisions = document?.revisions ?? [];
  const history = document?.history ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="4xl"
      title={
        document
          ? `History & Revisions — ${document.reference}`
          : "History & Revisions"
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {document ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Summary
              label="Current revision"
              value={`Rev ${document.currentRevision}`}
            />
            <Summary
              label="Status"
              value={
                document.workingRevision
                  ? `Revision ${document.workingRevision} in progress`
                  : document.status
              }
            />
            <Summary
              label="Superseded revisions"
              value={String(revisions.length)}
            />
          </div>
          {document.workingRevisionReason ? (
            <p className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-theme-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200">
              Reason for current revision: {document.workingRevisionReason}
            </p>
          ) : null}

          <Tabs<Tab>
            label="History sections"
            idPrefix="mom-history"
            tabs={[
              { id: "revisions", label: `Revisions (${revisions.length})` },
              { id: "audit", label: `Audit Trail (${history.length})` },
            ]}
            value={tab}
            onChange={setTab}
          >
            {tab === "revisions" ? (
              revisions.length === 0 ? (
                <p className="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                  No superseded revisions — this document has not been revised
                  since it was first finalized.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {revisions.map((r) => {
                    const isOpen = expanded === r.id;
                    return (
                      <li
                        key={r.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-800"
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 p-3 text-left"
                        >
                          <span className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                            <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                              Revision {r.revisionNumber}
                            </span>
                            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                              superseded by {r.userName ?? "—"} on{" "}
                              {new Date(r.createdAt).toLocaleString("en-IN")}
                            </span>
                          </span>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        {r.changeSummary ? (
                          <p className="px-3 pb-3 text-theme-xs text-gray-600 dark:text-gray-300">
                            Reason: {r.changeSummary}
                          </p>
                        ) : null}
                        {isOpen ? (
                          <div className="border-t border-gray-200 bg-gray-100 p-3 dark:border-gray-800 dark:bg-gray-800">
                            <MomDocumentSheet
                              data={toSheetData(document, {
                                ...(r.snapshotJson as MomRevisionSnapshot),
                                currentRevision: r.revisionNumber,
                              })}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                No activity recorded yet.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex gap-3 border-l-2 border-brand-200 pl-3 dark:border-brand-800"
                  >
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <p className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {ACTION_LABELS[h.action] ?? h.action.replace(/_/g, " ")}
                        {h.userName ? (
                          <span className="font-normal text-gray-500 dark:text-gray-400">
                            {" "}
                            — {h.userName}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {new Date(h.createdAt).toLocaleString("en-IN")}
                      </p>
                      {h.details ? (
                        <p className="mt-0.5 text-theme-sm text-gray-700 dark:text-gray-300">
                          {h.details}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Tabs>
        </div>
      ) : null}
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-theme-xs uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-theme-sm font-semibold capitalize text-gray-900 dark:text-white/90">
        {value}
      </p>
    </div>
  );
}
