"use client";

import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Not Interested queue — Accounts whose `statusTag` is "Not Interested".
 * Mirrors legacy TexaWave_ERP/src/modules/crm/NotInterested.tsx. */
export function NotInterestedQueue() {
  return (
    <AccountStatusQueueList
      tags={["Not Interested"]}
      title="Not Interested"
      description="Accounts currently marked Not Interested, with the reason preserved. Change status from here or the Account page to move it to another queue."
    />
  );
}
