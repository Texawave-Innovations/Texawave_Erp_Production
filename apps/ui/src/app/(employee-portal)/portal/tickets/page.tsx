import { MyTicketsView } from "@/features/hr/tickets/components/MyTicketsView";

// The one self-service tickets screen: the same view HR staff see for their own
// records (Docs/EMPLOYEE_SELF_SERVICE_API.md §4). `app/` stays thin —
// routing only (Docs/CODING_STANDARDS.md §4).
export default function PortalTicketsPage() {
  return <MyTicketsView />;
}
