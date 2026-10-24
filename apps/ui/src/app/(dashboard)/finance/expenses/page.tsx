import { ExpensesView } from "@/features/finance/expenses/components/ExpensesView";

export const metadata = {
  title: "Expenses | Finance | TexaWave ERP",
  description:
    "Track operating expenses, disburse employee claims, and verify General Ledger postings.",
};

export default function ExpensesPage() {
  return <ExpensesView />;
}
