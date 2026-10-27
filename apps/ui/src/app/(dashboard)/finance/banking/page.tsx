import { BankingView } from "@/features/finance/banking/components/BankingView";

export const metadata = {
  title: "Treasury & Banking | Finance | TexaWave ERP",
  description:
    "Manage company bank accounts, monitor cash balances, record transactions, and reconcile bank statements.",
};

export default function BankingPage() {
  return <BankingView />;
}
