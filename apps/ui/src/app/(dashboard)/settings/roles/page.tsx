import { RolesView } from "@/features/settings/roles/components/RolesView";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/settings/roles/` (Docs/CODING_STANDARDS.md §4).
export default function SettingsRolesPage() {
  return <RolesView />;
}
