// `app/` stays thin — routing only. The screen lives in `features/hr/employees/`
// (Docs/CODING_STANDARDS.md §4).
import { EmployeesView } from "@/features/hr/employees/components/EmployeesView";

export default function HrEmployeesPage() {
  return <EmployeesView />;
}
