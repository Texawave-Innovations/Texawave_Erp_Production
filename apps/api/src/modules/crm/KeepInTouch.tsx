// Seventh tab of the CRM module — Keep in Touch. A filtered, live view over the Core CRM
// `crm/accounts` records whose `statusTag` is "Keep in Touch" (see `domain/AccountStatusQueue`).
// Re-engagement date and reminder task come from the same status-change flow used on the
// Account 360 page — nothing is entered separately here.
import { MessageCircle } from "lucide-react";
import { AccountStatusQueue } from "./domain/AccountStatusQueue";

export default function KeepInTouch() {
  return (
    <AccountStatusQueue
      tags={["Keep in Touch"]}
      title="Keep in Touch"
      description="Accounts to re-engage later, with their reminder task and re-engagement date. Change status from here or the Account page to move it to another queue."
      icon={MessageCircle}
    />
  );
}
