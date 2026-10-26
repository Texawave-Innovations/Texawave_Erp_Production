import { PageHeader } from "@texawave-erp/ui-kit";
import { HrMasterView } from "@/features/hr-master/components/HrMasterView";
import { MastersTabBar } from "@/features/masters/MastersTabBar";

export default function HrMasterPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="hr" />
      <PageHeader
        title="HR Master"
        description="Departments, designations, office locations, leave types, and shifts used across the HR module."
      />
      <HrMasterView />
    </div>
  );
}
