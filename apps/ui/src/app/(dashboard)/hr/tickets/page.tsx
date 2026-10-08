import { TicketsView } from "@/features/hr/tickets/components/TicketsView";

// `app/` stays thin — routing only. The screen lives in
// `features/hr/tickets/` (Docs/CODING_STANDARDS.md §4).
export default function HrTicketsPage() {
  return <TicketsView />;
}
