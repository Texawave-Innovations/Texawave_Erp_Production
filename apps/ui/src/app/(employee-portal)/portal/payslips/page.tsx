import { MyPayslipsView } from "@/features/employee-self-service/payslips/components/MyPayslipsView";

// "My Payslips" portal tab (menu code portal-payslips, gated by
// employee_self_service.payslip.read), laid out like the legacy portal's
// month-card view. Employees reach their own payslips here without any HR
// payroll permission; the API returns only the caller's own rows
// (/self-service/payslips).
export default function PortalPayslipsPage() {
  return <MyPayslipsView />;
}
