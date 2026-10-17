"use client";

import { ThumbsUp } from "lucide-react";
import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Port of legacy `Interested.tsx` — Accounts whose `statusTag` is ["Interested"]. */
export function InterestedQueue() {
  return (
    <AccountStatusQueueList
      tags={["Interested"]}
      title="Interested"
      description="Accounts currently marked Interested, with their open opportunity, deal value, and owner. Change status from here or the Account page to move it to another queue."
      icon={ThumbsUp}
    />
  );
}
