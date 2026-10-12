"use client";

import type { Opportunity, PipelineStage } from "@texawave-erp/api-types";
import { Button, Dialog, Skeleton, StatusBadge } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  MarkLostDialog,
  MarkWonDialog,
  ReopenDialog,
  SetOnHoldDialog,
} from "./OpportunityActionDialogs";
import { DealProductsSection } from "./DealProductsSection";
import { DealQuotesSection } from "./DealQuotesSection";
import { useStageHistory } from "../hooks";

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  OPEN: "brand",
  WON: "success",
  LOST: "error",
  ON_HOLD: "warning",
};

/**
 * Reproduces legacy `domain/OpportunityDrawer.tsx`'s Overview, Products,
 * Quotes, and Stage History sections. Products and Quotes are now real,
 * persisted relationships (`OpportunityProduct`/`Quotation`,
 * Docs/CRM_PRODUCTS_LEGACY_PARITY.md §4/§6, Docs/CRM_QUOTES_LEGACY_PARITY.md
 * §6) — see `DealProductsSection`/`DealQuotesSection`. The Activities tab
 * is still deliberately NOT rendered — that entity doesn't exist in
 * production yet (Docs/CRM_LEGACY_PARITY.md), and a disabled/fake tab
 * would violate "no fake functional tabs or mock data." Add it back once
 * that entity lands.
 */
export function OpportunityDrawer({
  opportunity,
  stages,
  open,
  onClose,
}: {
  opportunity: Opportunity | null;
  stages: PipelineStage[];
  open: boolean;
  onClose: () => void;
}) {
  const [action, setAction] = useState<
    "won" | "lost" | "on-hold" | "reopen" | null
  >(null);
  const historyQuery = useStageHistory(opportunity?.id);

  if (!opportunity) return null;

  return (
    <Dialog open={open} onClose={onClose} title={opportunity.title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <StatusBadge
            label={opportunity.status.replace("_", " ")}
            colorToken={STATUS_COLOR[opportunity.status] ?? "gray"}
          />
          <span className="text-theme-sm text-gray-500">
            {opportunity.opportunityNumber}
          </span>
        </div>

        <section className="grid grid-cols-2 gap-3 text-theme-sm">
          <Field label="Account" value={opportunity.account.name} />
          <Field label="Owner" value={opportunity.ownerName} />
          <Field label="Stage" value={opportunity.stage.label} />
          <Field
            label="Estimated Value"
            value={`${opportunity.currency ?? "INR"} ${opportunity.estimatedValue}`}
          />
          <Field
            label="Probability"
            value={
              opportunity.probability !== null
                ? `${opportunity.probability}%`
                : opportunity.stage.probability !== null
                  ? `${opportunity.stage.probability}%`
                  : "—"
            }
          />
          <Field
            label="Expected Close"
            value={opportunity.expectedCloseDate?.slice(0, 10) ?? "—"}
          />
          <Field label="Priority" value={opportunity.priority ?? "—"} />
          <Field label="Contact" value={opportunity.contact?.name ?? "—"} />
        </section>

        {opportunity.status === "ON_HOLD" ? (
          <section className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-theme-sm dark:border-warning-900 dark:bg-warning-950/30">
            <p className="font-medium text-warning-700 dark:text-warning-300">
              On Hold — {opportunity.holdReason}
            </p>
            {opportunity.holdNotes ? (
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {opportunity.holdNotes}
              </p>
            ) : null}
          </section>
        ) : null}
        {opportunity.status === "LOST" ? (
          <section className="rounded-xl border border-error-200 bg-error-50 p-3 text-theme-sm dark:border-error-900 dark:bg-error-950/30">
            <p className="font-medium text-error-700 dark:text-error-300">
              Lost — {opportunity.lostReason}
            </p>
            {opportunity.competitor ? (
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Competitor: {opportunity.competitor}
              </p>
            ) : null}
          </section>
        ) : null}

        <DealProductsSection opportunityId={opportunity.id} />

        <DealQuotesSection
          opportunityId={opportunity.id}
          accountId={opportunity.accountId}
        />

        <section>
          <h3 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Stage History
          </h3>
          {historyQuery.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ol className="flex flex-col gap-2">
              {(historyQuery.data ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className="text-theme-xs text-gray-600 dark:text-gray-400 border-l-2 border-gray-200 pl-3 dark:border-gray-700"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {entry.fromStage ? `${entry.fromStage.label} → ` : ""}
                    {entry.toStage.label}
                  </span>
                  {" — "}
                  {new Date(entry.changedAt).toLocaleString()}
                  {entry.remarks ? (
                    <span className="block">{entry.remarks}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        {opportunity.status === "OPEN" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAction("won")}>
              Mark Won
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAction("lost")}
            >
              Mark Lost
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAction("on-hold")}
            >
              Put On Hold
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAction("reopen")}
            >
              Reopen
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={action === "won"}
        onClose={() => setAction(null)}
        title="Mark Won"
      >
        <MarkWonDialog
          opportunity={opportunity}
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      </Dialog>
      <Dialog
        open={action === "lost"}
        onClose={() => setAction(null)}
        title="Mark Lost"
      >
        <MarkLostDialog
          opportunity={opportunity}
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      </Dialog>
      <Dialog
        open={action === "on-hold"}
        onClose={() => setAction(null)}
        title="Put On Hold"
      >
        <SetOnHoldDialog
          opportunity={opportunity}
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      </Dialog>
      <Dialog
        open={action === "reopen"}
        onClose={() => setAction(null)}
        title="Reopen"
      >
        <ReopenDialog
          opportunity={opportunity}
          stages={stages}
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      </Dialog>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-theme-xs text-gray-400">{label}</p>
      <p className="text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  );
}
