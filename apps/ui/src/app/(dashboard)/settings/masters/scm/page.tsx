import { PageHeader } from "@texawave-erp/ui-kit";
import { ScmMasterView } from "@/features/scm/master-list-items/components/ScmMasterView";
import { MastersTabBar } from "@/features/masters/MastersTabBar";

export default function ScmMasterPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="scm" />
      <PageHeader
        title="SCM Master"
        description="Supplier types, package types, warehouse types and stock adjustment reasons used across SCM."
      />
      <ScmMasterView />
    </div>
  );
}
