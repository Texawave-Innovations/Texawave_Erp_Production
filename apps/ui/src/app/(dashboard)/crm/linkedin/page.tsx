import { ChannelActivityQueue } from "@/features/crm/channel-queues/components/ChannelActivityQueue";

export default function CrmLinkedInPage() {
  return (
    <ChannelActivityQueue
      activityType="LinkedIn"
      title="LinkedIn"
      description="LinkedIn touchpoints logged against Accounts/Contacts - also visible on each Account's Activity Timeline."
    />
  );
}
