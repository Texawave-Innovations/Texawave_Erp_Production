import { EmployeeDashboardView } from "@/features/employee-self-service/dashboard/components/EmployeeDashboardView";

// Employee portal home — the legacy employee dashboard (greeting, attendance
// clock, this month's stats, quick links). `app/` stays thin — routing only.
export default function PortalHomePage() {
  return <EmployeeDashboardView />;
}
