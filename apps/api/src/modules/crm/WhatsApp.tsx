// Eighth tab of the CRM module — WhatsApp. An interaction/channel view, not a customer status:
// every logged WhatsApp touchpoint is a Core CRM Activity against an existing Account/Contact
// (see `domain/ChannelActivityQueue`), so it also shows on that Account's unified Timeline and
// updates Last Touch — no separate dataset, no duplicate Account.
import { MessageSquare } from "lucide-react";
import { ChannelActivityQueue } from "./domain/ChannelActivityQueue";

export default function WhatsApp() {
  return (
    <ChannelActivityQueue
      activityType="WhatsApp"
      title="WhatsApp"
      description="WhatsApp touchpoints logged against Accounts/Contacts — also visible on each Account's Activity Timeline."
      icon={MessageSquare}
    />
  );
}
