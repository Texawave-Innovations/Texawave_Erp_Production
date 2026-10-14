import { MyTaxView } from "@/features/hr/payroll/components/MyTaxView";

// "My Tax" portal tab (menu code portal-tax, gated by
// employee_self_service.tax_declaration.read): the employee's own tax
// declaration and Form 16. The API returns only the caller's own records.
export default function PortalTaxPage() {
  return <MyTaxView />;
}
