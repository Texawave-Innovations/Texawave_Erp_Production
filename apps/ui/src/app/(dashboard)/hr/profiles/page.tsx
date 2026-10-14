// `app/` stays thin — routing only. The screen lives in `features/hr/profiles/`
// (Docs/CODING_STANDARDS.md §4).
import { ProfilesListView } from "@/features/hr/profiles/components/ProfilesListView";

export default function HrProfilesPage() {
  return <ProfilesListView />;
}
