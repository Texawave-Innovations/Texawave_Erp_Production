import { PayrollView } from "@/features/hr/payroll/components/PayrollView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/payroll/` (Docs/CODING_STANDARDS.md §4).
export default function HrPayrollPage() {
  return <PayrollView />;
}
