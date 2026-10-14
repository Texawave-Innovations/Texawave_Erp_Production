"use client";

import { type TabItem, Tabs } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { ESI_READ, PF_READ } from "../permissions";
import { CompliancePanel } from "./CompliancePanel";
import { NoAccess, SectionHeader } from "./SectionHeader";

type ComplianceTab = "pf" | "esi";

/** HR → Compliance: PF and ESI profiles and contributions. */
export function ComplianceView() {
  const canPf = usePermission(PF_READ);
  const canEsi = usePermission(ESI_READ);

  const tabs: TabItem<ComplianceTab>[] = [];
  if (canPf) tabs.push({ id: "pf", label: "PF" });
  if (canEsi) tabs.push({ id: "esi", label: "ESI" });

  const [requested, setRequested] = useState<ComplianceTab>("pf");
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    <div className="flex min-w-0 flex-col gap-6 contain-[inline-size]">
      <SectionHeader
        icon={ShieldCheck}
        title="Compliance"
        description="Maintain employee PF and ESI registrations and review statutory contributions per payroll period."
        badge={
          tabs.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white/70 text-brand-500 shadow-xs dark:bg-white/10 dark:text-cyan-300">
              {tabs.length} {tabs.length === 1 ? "section" : "sections"}
            </span>
          ) : undefined
        }
      />
      {!active ? (
        <NoAccess area="Compliance" />
      ) : (
        <Tabs
          label="Compliance sections"
          idPrefix="compliance"
          tabs={tabs}
          value={active.id}
          onChange={setRequested}
        >
          {active.id === "pf" ? <CompliancePanel kind="pf" /> : null}
          {active.id === "esi" ? <CompliancePanel kind="esi" /> : null}
        </Tabs>
      )}
    </div>
  );
}
