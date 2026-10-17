// Sixth tab of the CRM module — Not Interested. A filtered, live view over the Core CRM
// `crm/accounts` records whose `statusTag` is "Not Interested" (see `domain/AccountStatusQueue`).
// There is no separate dataset here: changing an Account's status from this tab, the Account 360
// page, or the Accounts list all write the same record, so the account moves between the
// Interested / Not Interested / Keep in Touch / Call Back-Send Info tabs automatically and never
// duplicates.
import { UserX } from "lucide-react";
import { AccountStatusQueue } from "./domain/AccountStatusQueue";

export default function NotInterested() {
  return (
    <AccountStatusQueue
      tags={["Not Interested"]}
      title="Not Interested"
      description="Accounts currently marked Not Interested, with the reason preserved. Change status from here or the Account page to move it to another queue."
      icon={UserX}
    />
  );
}
