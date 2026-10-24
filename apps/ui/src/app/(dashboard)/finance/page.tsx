import { redirect } from "next/navigation";

/**
 * Root /finance entrypoint: seamlessly redirects to Chart of Accounts (/finance/accounts)
 */
export default function FinanceRootPage() {
  redirect("/finance/accounts");
}
