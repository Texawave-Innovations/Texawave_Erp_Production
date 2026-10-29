import { AccountsView } from "@/features/finance/coa/components/AccountsView";

export const metadata = {
  title: "Chart of Accounts | TexaWave ERP",
  description:
    "General ledger account hierarchy, classifications, and balances",
};

export default function FinanceAccountsPage() {
  return <AccountsView />;
}
