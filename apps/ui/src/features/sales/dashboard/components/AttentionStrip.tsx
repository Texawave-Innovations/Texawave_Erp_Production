"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@texawave-erp/ui-kit";
import { formatInr } from "../../shared/format";
import { salesTabHref, type SalesTabId } from "../../shared/tabs";
import type { AttentionKind, SalesDashboard } from "../types";

const ATTENTION: Record<
  AttentionKind,
  {
    title: (n: number) => string;
    variant: "info" | "warning" | "error";
    /** Where to act on it; follow-ups live on this page's checklist. */
    tab: SalesTabId | null;
  }
> = {
  unpaid_invoices: {
    title: (n) => `${n} unpaid invoice${n === 1 ? "" : "s"}`,
    variant: "warning",
    tab: "tax-invoices",
  },
  pending_quotations: {
    title: (n) => `${n} quotation${n === 1 ? "" : "s"} awaiting the customer`,
    variant: "info",
    tab: "quotations",
  },
  overdue_invoices: {
    title: (n) => `${n} invoice${n === 1 ? "" : "s"} unpaid for over 90 days`,
    variant: "error",
    tab: "tax-invoices",
  },
  open_returnable_dcs: {
    title: (n) => `${n} returnable DC${n === 1 ? "" : "s"} not returned`,
    variant: "info",
    tab: "returnable-dcs",
  },
  overdue_follow_ups: {
    title: (n) => `${n} overdue follow-up${n === 1 ? "" : "s"}`,
    variant: "warning",
    tab: null,
  },
};

const LINK =
  "font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2";

/** Items that need action, each linking to where it is handled. */
export function AttentionStrip({
  items,
}: {
  items: SalesDashboard["needsAttention"];
}) {
  // Dismissed for this visit only; they come back on reload while still true.
  const [dismissed, setDismissed] = useState<ReadonlySet<AttentionKind>>(
    new Set(),
  );
  const visible = items.filter((a) => !dismissed.has(a.kind));
  if (visible.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Needs attention">
      {visible.map((a) => {
        const cfg = ATTENTION[a.kind];
        return (
          <Alert
            key={a.kind}
            variant={cfg.variant}
            title={cfg.title(a.count)}
            onClose={() => setDismissed((s) => new Set(s).add(a.kind))}
          >
            {a.amount ? `${formatInr(a.amount)} in total. ` : null}
            {cfg.tab ? (
              <Link href={salesTabHref(cfg.tab)} className={LINK}>
                View
              </Link>
            ) : (
              <a href="#sales-checklist" className={LINK}>
                Go to checklist
              </a>
            )}
          </Alert>
        );
      })}
    </section>
  );
}
