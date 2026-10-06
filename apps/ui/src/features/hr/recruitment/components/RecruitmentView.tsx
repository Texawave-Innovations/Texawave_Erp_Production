"use client";

import { Alert } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { RECRUITMENT_PERMISSIONS as P } from "../permissions";
import { InterviewsPanel } from "./InterviewsPanel";
import { OffersPanel } from "./OffersPanel";
import { RevisionsPanel } from "./RevisionsPanel";

type TabId = "interviews" | "offers" | "revisions";

interface TabDef {
  id: TabId;
  label: string;
}

/** HR → Recruitment. Three tabs, mirroring legacy `Recruitment.tsx`. Each tab
 * shows only when the user can read it; writes are gated per tab. */
export function RecruitmentView() {
  const canReadInterviews = usePermission(P.interviewRead);
  const canWriteInterviews = usePermission(P.interviewWrite);
  const canReadOffers = usePermission(P.offerRead);
  const canWriteOffers = usePermission(P.offerWrite);
  const canReadRevisions = usePermission(P.revisionRead);
  const canWriteRevisions = usePermission(P.revisionWrite);
  const canReadEmployees = usePermission(P.employeeRead);

  const tabs: TabDef[] = [];
  if (canReadInterviews)
    tabs.push({ id: "interviews", label: "Interview schedule" });
  if (canReadOffers) tabs.push({ id: "offers", label: "Offer letter" });
  if (canReadRevisions)
    tabs.push({ id: "revisions", label: "Revision letter" });

  const [requested, setRequested] = useState<TabId>("interviews");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    // `contain: inline-size` stops wide table content from widening the
    // dashboard's flex <main> (its min-width is auto), so tables scroll inside
    // their own wrapper instead of pushing the page sideways.
    <div className="flex min-w-0 flex-col gap-6 [contain:inline-size]">
      <header className="rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-theme-md sm:p-8">
        <h1 className="text-theme-xl font-bold tracking-tight sm:text-2xl">
          Recruitment &amp; onboarding
        </h1>
        <p className="mt-1 max-w-2xl text-theme-sm text-brand-50">
          Manage the interview pipeline, generate offer letters, and issue
          salary revision letters.
        </p>
      </header>

      {tabs.length === 0 ? (
        <Alert variant="warning" title="No access">
          Your role does not include any Recruitment permissions. Ask an
          administrator to grant access.
        </Alert>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Recruitment sections"
            className="flex w-full flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:w-auto sm:inline-flex dark:border-gray-800 dark:bg-gray-800/50"
          >
            {tabs.map((tab) => {
              const selected = active?.id === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`recruitment-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`recruitment-panel-${tab.id}`}
                  onClick={() => setRequested(tab.id)}
                  className={`flex-1 rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors sm:flex-none ${
                    selected
                      ? "bg-brand-500 text-gray-900 shadow-theme-xs"
                      : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={active ? `recruitment-panel-${active.id}` : undefined}
            aria-labelledby={
              active ? `recruitment-tab-${active.id}` : undefined
            }
          >
            {active?.id === "interviews" ? (
              <InterviewsPanel canWrite={canWriteInterviews} />
            ) : null}
            {active?.id === "offers" ? (
              <OffersPanel canWrite={canWriteOffers} />
            ) : null}
            {active?.id === "revisions" ? (
              <RevisionsPanel
                canWrite={canWriteRevisions}
                canReadEmployees={canReadEmployees}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
