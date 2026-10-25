import { WebCheckinView } from "@/features/employee-self-service/dashboard/components/WebCheckinView";

// Legacy "Check In / Out" portal tab (gated in the sidebar by
// employee_self_service.attendance.punch). `app/` stays thin — routing only
// (Docs/CODING_STANDARDS.md §4).
export default function PortalCheckinPage() {
  return <WebCheckinView />;
}
