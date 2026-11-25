import { redirect } from "next/navigation";

// List screens live in the Sales workspace tabs (/sales?tab=…).
export default function RedirectTax() {
  redirect("/sales?tab=tax-invoices");
}
