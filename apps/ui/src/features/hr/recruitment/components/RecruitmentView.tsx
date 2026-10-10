"use client";

import { Alert } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermission } from "@/hooks/usePermission";
import { RECRUITMENT_PERMISSIONS as P } from "../permissions";
import { CandidatesPanel } from "./CandidatesPanel";
import { InterviewsPanel } from "./InterviewsPanel";
import { OffersPanel } from "./OffersPanel";
import { PromotionsPanel } from "./PromotionsPanel";
import { RevisionsPanel } from "./RevisionsPanel";

type TabId =
  "interviews" | "offers" | "revisions" | "promotions" | "candidates";

interface TabDef {
  id: TabId;
  label: string;
}

/** HR → Recruitment. Interview / Offer / Revision tabs mirror legacy
 * `Recruitment.tsx`; Promotion letter and the Candidates pipeline are new.
 * Each tab shows only when the user can read it; writes are gated per tab. */
export function RecruitmentView() {
  const canReadInterviews = usePermission(P.interviewRead);
  const canWriteInterviews = usePermission(P.interviewWrite);
  const canReadOffers = usePermission(P.offerRead);
  const canWriteOffers = usePermission(P.offerWrite);
  const canReadRevisions = usePermission(P.revisionRead);
  const canWriteRevisions = usePermission(P.revisionWrite);
  const canReadPromotions = usePermission(P.promotionRead);
  const canWritePromotions = usePermission(P.promotionWrite);
  const canReadDesignations = usePermission(P.designationRead);
  const canWriteDesignations = usePermission(P.designationWrite);
  const canReadEmployees = usePermission(P.employeeRead);

  // Tab gating preserving e2e test contract (e.g. read-only interview user sees exactly 1 tab)
  const tabs: TabDef[] = [];
  if (canReadInterviews)
    tabs.push({ id: "interviews", label: "Interview schedule" });
  if (canReadOffers) tabs.push({ id: "offers", label: "Offer letter" });
  if (canReadRevisions)
    tabs.push({ id: "revisions", label: "Revision letter" });
  if (canReadPromotions)
    tabs.push({ id: "promotions", label: "Promotion letter" });
  if (canReadInterviews && canReadOffers && canReadRevisions)
    tabs.push({ id: "candidates", label: "Candidates" });

  const [requested, setRequested] = useState<TabId>("interviews");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    // `contain: inline-size` stops wide table content from widening the
    // dashboard's flex <main> (its min-width is auto), so tables scroll inside
    // their own wrapper instead of pushing the page sideways.
    <div className="flex min-w-0 flex-col gap-6 [contain:inline-size]">
      <PageHeader
        title="Recruitment & onboarding"
        description="Schedule interviews, generate offer letters, issue salary revision and promotion letters, and manage the talent pipeline."
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
            {active?.id === "promotions" ? (
              <PromotionsPanel
                canWrite={canWritePromotions}
                canReadEmployees={canReadEmployees}
                canReadDesignations={canReadDesignations}
                canAddDesignation={canWriteDesignations}
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
