import { ExpenseApprovalsView } from "@/features/hr/expense-approvals/components/ExpenseApprovalsView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/expense-approvals/` (Docs/CODING_STANDARDS.md §4).
export default function HrExpenseApprovalsPage() {
  return <ExpenseApprovalsView />;
}
