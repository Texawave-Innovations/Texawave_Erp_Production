import { redirect } from "next/navigation";

// List screens live in the Sales workspace tabs (/sales?tab=…).
export default function RedirectQuotations() {
  redirect("/sales?tab=quotations");
}
