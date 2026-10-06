import { EmployeesView } from "@/features/hr/employees/components/EmployeesView";

// `app/` stays thin — routing only. The screen lives in `features/hr/employees/`
// (Docs/CODING_STANDARDS.md §4).
export default function HrEmployeesPage() {
  return <EmployeesView />;
}
