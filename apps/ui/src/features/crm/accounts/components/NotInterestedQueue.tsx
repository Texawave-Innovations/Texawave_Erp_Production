"use client";

import { UserX } from "lucide-react";
import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Port of legacy `NotInterested.tsx` — Accounts whose `statusTag` is ["Not Interested"]. */
export function NotInterestedQueue() {
  return (
    <AccountStatusQueueList
      tags={["Not Interested"]}
      title="Not Interested"
      description="Accounts currently marked Not Interested, with the reason preserved. Change status from here or the Account page to move it to another queue."
      icon={UserX}
    />
  );
}
