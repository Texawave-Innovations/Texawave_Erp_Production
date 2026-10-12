import { Mail } from "lucide-react";
import { ChannelActivityQueue } from "./domain/ChannelActivityQueue";

export default function Email() {
  return (
    <ChannelActivityQueue
      activityType="Email"
      title="Email"
      description="Email touchpoints logged against Accounts/Contacts — also visible on each Account's Activity Timeline."
      icon={Mail}
    />
  );
}
