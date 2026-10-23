"use client";

import { PhoneCall } from "lucide-react";
import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Port of legacy `CallBackSendInfo.tsx` — Accounts whose `statusTag` is ["Call Back", "Send Info"]. */
export function CallBackSendInfoQueue() {
  return (
    <AccountStatusQueueList
      tags={["Call Back", "Send Info"]}
      title="Call Back-Send Info"
      description="Accounts awaiting a call back or requested information — each labeled by Type. Complete/Mark Sent updates the task; Change Status can reschedule the date."
      icon={PhoneCall}
    />
  );
}
