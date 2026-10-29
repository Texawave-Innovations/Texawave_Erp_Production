import { redirect } from "next/navigation";

/**
 * Finance Accounting landing page: seamlessly redirects to General Ledger (/finance/general-ledger)
 */
export default function FinanceAccountingPage() {
  redirect("/finance/general-ledger");
}
