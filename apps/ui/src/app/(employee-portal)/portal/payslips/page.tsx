import { MyPayslipsSection } from "@/features/hr/payroll/components/PayslipsPanel";

// "My Payslips" portal tab (menu code portal-payslips, gated by
// employee_self_service.payslip.read). Employees reach their own payslips
// here without any HR payroll permission; the API returns only the
// caller's own rows (/self-service/payslips).
export default function PortalPayslipsPage() {
  return <MyPayslipsSection />;
}
