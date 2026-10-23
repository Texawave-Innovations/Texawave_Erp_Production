import { ChannelActivityQueue } from "@/features/crm/channel-queues/components/ChannelActivityQueue";

export default function CrmEmailPage() {
  return (
    <ChannelActivityQueue
      activityType="Email"
      title="Email"
      description="Email touchpoints logged against Accounts/Contacts - also visible on each Account's Activity Timeline."
    />
  );
}
