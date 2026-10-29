import { redirect } from "next/navigation";

// /sales has no screen of its own; the Sales workspace opens on its dashboard.
export default function SalesPage() {
  redirect("/sales/dashboard");
}
