"use client";

import { MessageCircle } from "lucide-react";
import { AccountStatusQueueList } from "./AccountStatusQueueList";

/** Port of legacy `KeepInTouch.tsx` — Accounts whose `statusTag` is ["Keep in Touch"]. */
export function KeepInTouchQueue() {
  return (
    <AccountStatusQueueList
      tags={["Keep in Touch"]}
      title="Keep in Touch"
      description="Accounts to re-engage later, with their reminder task and re-engagement date. Change status from here or the Account page to move it to another queue."
      icon={MessageCircle}
    />
  );
}
