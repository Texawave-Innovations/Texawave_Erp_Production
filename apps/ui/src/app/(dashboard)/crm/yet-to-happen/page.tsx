import { YetToHappenList } from "@/features/crm/yet-to-happen/components/YetToHappenList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/yet-to-happen/` (Docs/CODING_STANDARDS.md §4).
export default function CrmYetToHappenPage() {
  return <YetToHappenList />;
}
