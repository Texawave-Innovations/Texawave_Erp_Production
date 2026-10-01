import { redirect } from "next/navigation";

// Roles live at /admin/roles (Docs/ARCHITECTURE.md — admin/ = users/roles/
// permissions). Kept as a redirect so existing links to the old path still work.
export default function SettingsRolesPage() {
  redirect("/admin/roles");
}
