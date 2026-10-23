// Ninth tab of the CRM module — LinkedIn. An interaction/channel view, not a customer status:
// every logged LinkedIn touchpoint is a Core CRM Activity against an existing Account/Contact
// (see `domain/ChannelActivityQueue`), so it also shows on that Account's unified Timeline and
// updates Last Touch — no separate dataset, no duplicate Account/Contact.
import { Linkedin } from "lucide-react";
import { ChannelActivityQueue } from "./domain/ChannelActivityQueue";

export default function LinkedIn() {
  return (
    <ChannelActivityQueue
      activityType="LinkedIn"
      title="LinkedIn"
      description="LinkedIn touchpoints logged against Accounts/Contacts — also visible on each Account's Activity Timeline."
      icon={Linkedin}
    />
  );
}
