"use client";

import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Keep in Touch queue — Accounts whose `statusTag` is "Keep in Touch".
 * Mirrors legacy TexaWave_ERP/src/modules/crm/KeepInTouch.tsx. */
export function KeepInTouchQueue() {
  return (
    <AccountStatusQueueList
      tags={["Keep in Touch"]}
      title="Keep in Touch"
      description="Accounts to re-engage later, with their re-engagement date. Change status from here or the Account page to move it to another queue."
    />
  );
}
