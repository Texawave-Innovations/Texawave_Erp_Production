"use client";

import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Interested queue — Accounts whose `statusTag` is "Interested". Mirrors
 * legacy TexaWave_ERP/src/modules/crm/Interested.tsx. */
export function InterestedQueue() {
  return (
    <AccountStatusQueueList
      tags={["Interested"]}
      title="Interested"
      description="Accounts currently marked Interested. Change status from here or the Account page to move it to another queue."
    />
  );
}
