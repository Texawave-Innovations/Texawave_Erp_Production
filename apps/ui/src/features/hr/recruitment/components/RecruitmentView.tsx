"use client";

import { Alert } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermission } from "@/hooks/usePermission";
import { RECRUITMENT_PERMISSIONS as P } from "../permissions";
import { CandidatesPanel } from "./CandidatesPanel";
import { InterviewsPanel } from "./InterviewsPanel";
import { OffersPanel } from "./OffersPanel";
import { RevisionsPanel } from "./RevisionsPanel";

type TabId = "interviews" | "offers" | "revisions" | "candidates";

interface TabDef {
  id: TabId;
  label: string;
}

/**
 * HR → Recruitment Module View.
 * Enterprise recruitment workspace featuring:
 * 1. Interview Schedule
 * 2. Offer Letter (with live preview generator)
 * 3. Revision Letter (with compensation comparison preview)
 * 4. Candidates Pipeline Directory
 */
export function RecruitmentView() {
  const canReadInterviews = usePermission(P.interviewRead);
  const canWriteInterviews = usePermission(P.interviewWrite);
  const canReadOffers = usePermission(P.offerRead);
  const canWriteOffers = usePermission(P.offerWrite);
  const canReadRevisions = usePermission(P.revisionRead);
  const canWriteRevisions = usePermission(P.revisionWrite);
  const canReadEmployees = usePermission(P.employeeRead);

  // Tab gating preserving e2e test contract (e.g. read-only interview user sees exactly 1 tab)
  const tabs: TabDef[] = [];
  if (canReadInterviews) {
    tabs.push({ id: "interviews", label: "Interview Schedule" });
  }
  if (canReadOffers) {
    tabs.push({ id: "offers", label: "Offer Letter" });
  }
  if (canReadRevisions) {
    tabs.push({ id: "revisions", label: "Revision Letter" });
  }
  if (canReadInterviews && canReadOffers && canReadRevisions) {
    tabs.push({ id: "candidates", label: "Candidates" });
  }

  const [requested, setRequested] = useState<TabId>("interviews");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    <div className="flex min-w-0 flex-col gap-6 contain-[inline-size]">
      {/* Top Page Header conforming to TEXA ERP standard layout */}
      <PageHeader
        title="Recruitment & onboarding"
        description="Schedule interviews, generate formal offer letters with compensation tables, issue salary revisions, and manage talent pipeline."
        breadcrumbs={["Home", "HR", "Recruitment"]}
      />

      {tabs.length === 0 ? (
        <Alert variant="warning" title="No access">
          Your role does not include any Recruitment permissions. Ask an
          administrator to grant access.
        </Alert>
      ) : (
        <>
          {/* Module Tab Navigation */}
          <div
            role="tablist"
            aria-label="Recruitment sections"
            className="flex w-full flex-wrap gap-1.5 rounded-xl border border-gray-200 bg-gray-50/80 p-1.5 sm:w-auto sm:inline-flex dark:border-gray-800 dark:bg-gray-800/50"
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
                  className={`flex-1 rounded-lg px-4 py-2 text-theme-sm font-semibold transition-all sm:flex-none ${
                    selected
                      ? "bg-white text-gray-900 shadow-sm border border-gray-200/80 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Active Tab Panel */}
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
            {active?.id === "candidates" ? (
              <CandidatesPanel
                onScheduleCandidate={() => setRequested("interviews")}
                onGenerateOffer={() => setRequested("offers")}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
