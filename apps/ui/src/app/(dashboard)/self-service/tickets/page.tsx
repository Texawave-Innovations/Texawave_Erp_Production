import { redirect } from "next/navigation";

// Self-service screens live in the employee portal only — this old dashboard
// route just forwards there, so bookmarks and old links keep working.
// Docs/EMPLOYEE_SELF_SERVICE_API.md §4.
export default function SelfServiceTicketsPage() {
  redirect("/portal/tickets");
}
