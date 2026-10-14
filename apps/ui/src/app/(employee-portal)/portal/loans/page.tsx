import { MyLoansSection } from "@/features/hr/payroll/components/LoansPanel";

// "My Loans" portal tab (menu code portal-loans, gated by
// employee_self_service.loan.read). Own loans only (/self-service/loans).
export default function PortalLoansPage() {
  return <MyLoansSection />;
}
