import { MastersTabBar } from "@/features/masters/MastersTabBar";
import { MasterListView } from "@/features/sales/master-list/components/MasterListView";

export default function SalesMasterListPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="sales" />
      <MasterListView />
    </div>
  );
}
