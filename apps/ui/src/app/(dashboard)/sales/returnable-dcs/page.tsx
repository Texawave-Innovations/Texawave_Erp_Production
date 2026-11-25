import { redirect } from "next/navigation";

// List screens live in the Sales workspace tabs (/sales?tab=…).
export default function RedirectRdcs() {
  redirect("/sales?tab=returnable-dcs");
}
