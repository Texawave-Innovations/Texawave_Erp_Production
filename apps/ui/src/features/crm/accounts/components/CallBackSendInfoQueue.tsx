"use client";

import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Call Back / Send Info queue — a single, unified view over Accounts whose
 * `statusTag` is "Call Back" OR "Send Info", each labeled by its Type
 * column. Mirrors legacy TexaWave_ERP/src/modules/crm/CallBackSendInfo.tsx. */
export function CallBackSendInfoQueue() {
  return (
    <AccountStatusQueueList
      tags={["Call Back", "Send Info"]}
      title="Call Back / Send Info"
      description="Accounts awaiting a call back or requested information — each labeled by Type. Change Status can reschedule the date or mark the info as sent."
    />
  );
}
