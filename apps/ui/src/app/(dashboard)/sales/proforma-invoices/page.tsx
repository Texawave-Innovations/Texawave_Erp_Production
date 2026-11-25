import { redirect } from "next/navigation";

// List screens live in the Sales workspace tabs (/sales?tab=…).
export default function RedirectProforma() {
  redirect("/sales?tab=proforma-invoices");
}
