import { RegularizationView } from "@/features/hr/regularization/components/RegularizationView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/regularization/` (Docs/CODING_STANDARDS.md §4).
export default function HrRegularizationPage() {
  return <RegularizationView />;
}
