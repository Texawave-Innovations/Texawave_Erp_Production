import { redirect } from "next/navigation";

/**
 * Root /finance entrypoint: seamlessly redirects to General Ledger (/finance/general-ledger)
 */
export default function FinanceRootPage() {
  redirect("/finance/general-ledger");
}
