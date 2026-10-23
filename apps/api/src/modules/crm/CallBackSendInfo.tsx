// Fifth tab of the CRM module — Call Back-Send Info. A single, unified operational queue over
// the Core CRM `crm/accounts` records whose `statusTag` is "Call Back" or "Send Info" (see
// `domain/AccountStatusQueue`), each clearly labeled by its Type column. Completing/marking-sent
// updates the linked follow-up task on the same Account record — no separate dataset.
import { PhoneCall } from "lucide-react";
import { AccountStatusQueue } from "./domain/AccountStatusQueue";

export default function CallBackSendInfo() {
  return (
    <AccountStatusQueue
      tags={["Call Back", "Send Info"]}
      title="Call Back-Send Info"
      description="Accounts awaiting a call back or requested information — each labeled by Type. Complete/Mark Sent updates the task; Change Status can reschedule the date."
      icon={PhoneCall}
    />
  );
}
