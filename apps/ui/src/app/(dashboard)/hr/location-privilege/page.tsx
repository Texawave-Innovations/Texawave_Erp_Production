import { LocationPrivilegeView } from "@/features/hr/location-privilege/components/LocationPrivilegeView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/location-privilege/` (Docs/CODING_STANDARDS.md §4).
export default function HrLocationPrivilegePage() {
  return <LocationPrivilegeView />;
}
