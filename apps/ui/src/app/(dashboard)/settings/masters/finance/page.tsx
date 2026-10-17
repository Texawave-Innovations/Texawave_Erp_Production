import { PageHeader } from "@texawave-erp/ui-kit";
import { FinanceMasterView } from "@/features/finance-settings/components/FinanceMasterView";
import { MastersTabBar } from "@/features/masters/MastersTabBar";

export default function FinanceMasterPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="finance" />
      <PageHeader
        title="Finance Master"
        description="Expense types and payment modes used across the Finance module."
      />
      <FinanceMasterView />
    </div>
  );
}
