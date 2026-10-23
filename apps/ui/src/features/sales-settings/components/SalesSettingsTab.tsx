"use client";

import { Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { BankAndSignatoryTab } from "./BankAndSignatoryTab";
import { CompanyDetailForm } from "./CompanyDetailForm";
import { DocumentNumberingPanel } from "./DocumentNumberingPanel";
import { SalespersonsPanel } from "./SalespersonsPanel";

type SalesSettingsSubTab =
  "company" | "numbering" | "bank-signatory" | "salespersons";

const TABS: TabItem<SalesSettingsSubTab>[] = [
  { id: "company", label: "Company" },
  { id: "numbering", label: "Numbering" },
  { id: "bank-signatory", label: "Bank & Signatory" },
  { id: "salespersons", label: "Salespersons" },
];

/** "Sales Settings" top-level tab — 4 sub-tabs. */
export function SalesSettingsTab() {
  const [active, setActive] = useState<SalesSettingsSubTab>("company");

  return (
    <Tabs
      label="Sales Settings sections"
      idPrefix="sales-settings"
      tabs={TABS}
      value={active}
      onChange={setActive}
    >
      {active === "company" ? <CompanyDetailForm /> : null}
      {active === "numbering" ? <DocumentNumberingPanel /> : null}
      {active === "bank-signatory" ? <BankAndSignatoryTab /> : null}
      {active === "salespersons" ? <SalespersonsPanel /> : null}
    </Tabs>
  );
}
