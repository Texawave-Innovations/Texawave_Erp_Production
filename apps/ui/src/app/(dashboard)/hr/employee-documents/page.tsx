// `app/` stays thin — routing only. The screen lives in
// `features/hr/employee-documents/` (Docs/CODING_STANDARDS.md §4).
import { EmployeeDocumentsListView } from "@/features/hr/employee-documents/components/EmployeeDocumentsListView";

export default function HrEmployeeDocumentsPage() {
  return <EmployeeDocumentsListView />;
}
