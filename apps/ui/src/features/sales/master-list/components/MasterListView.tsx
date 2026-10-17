"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Alert, PageHeader, Tabs } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { CompanyTab } from "./CompanyTab";
import { DocumentFieldsTab } from "./DocumentFieldsTab";
import { NumberingTab } from "./NumberingTab";

type Tab = "numbering" | "company" | "fields";

const TABS = [
  { id: "numbering", label: "Numbering" },
  { id: "company", label: "Company details" },
  { id: "fields", label: "Document fields" },
] as const;

/**
 * Sales master list: numbering (code formats and running numbers), the
 * company details printed on every document, and the options each
 * document form offers. Reading needs `sales.master.read`; editing needs
 * `sales.master.write` (running numbers: `sales.running_number.write`).
 */
export function MasterListView() {
  const canRead = usePermission(SALES_PERMISSIONS.masterRead);
  const [tab, setTab] = useState<Tab>("numbering");

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to the master list">
        Ask an administrator for the <code>sales.master.read</code> permission.
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Master list"
        description="Document numbering, company details and the options offered on every Sales form."
        icon={ListChecks}
      />
      <Tabs
        label="Master list sections"
        idPrefix="sales-master"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "numbering" ? (
          <NumberingTab />
        ) : tab === "company" ? (
          <CompanyTab />
        ) : (
          <DocumentFieldsTab />
        )}
      </Tabs>
    </div>
  );
}
