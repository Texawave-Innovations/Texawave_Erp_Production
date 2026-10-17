import { ChannelActivityQueue } from "@/features/crm/channel-queues/components/ChannelActivityQueue";

export default function CrmWhatsAppPage() {
  return (
    <ChannelActivityQueue
      activityType="WhatsApp"
      title="WhatsApp"
      description="WhatsApp touchpoints logged against Accounts/Contacts - also visible on each Account's Activity Timeline."
    />
  );
}
