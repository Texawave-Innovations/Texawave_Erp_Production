import { SalesSettingsView } from "@/features/sales-settings/components/SalesSettingsView";
import { MastersTabBar } from "@/features/masters/MastersTabBar";

export default function SalesSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <MastersTabBar active="sales-document" />
      <SalesSettingsView />
    </div>
  );
}
