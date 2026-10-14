import { FullMonthPresentView } from "@/features/hr/full-month-present/components/FullMonthPresentView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/full-month-present/` (Docs/CODING_STANDARDS.md §4).
export default function HrFullMonthPresentPage() {
  return <FullMonthPresentView />;
}
