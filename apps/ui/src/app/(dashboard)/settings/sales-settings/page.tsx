import { redirect } from "next/navigation";

/**
 * The old "Sales & Document Masters" screen is retired; the Sales master
 * lives at /sales/master-list. Kept so existing links and bookmarks work.
 */
export default function SalesSettingsRedirectPage() {
  redirect("/sales/master-list");
}
