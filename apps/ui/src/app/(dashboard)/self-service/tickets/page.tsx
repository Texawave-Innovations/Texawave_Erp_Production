import { MyTicketsView } from "@/features/hr/tickets/components/MyTicketsView";

// `app/` stays thin — routing only. The screen lives in `features/hr/tickets/`
// (Docs/CODING_STANDARDS.md §4).
export default function SelfServiceTicketsPage() {
  return <MyTicketsView />;
}
