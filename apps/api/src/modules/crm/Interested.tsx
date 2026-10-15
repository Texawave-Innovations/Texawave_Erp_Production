// New CRM tab — Interested. A filtered, live view over the Core CRM `crm/accounts` records whose
// `statusTag` is "Interested" (see `domain/AccountStatusQueue`). Same single-source-of-truth
// pattern as Not Interested / Keep in Touch / Call Back-Send Info: no separate dataset, and the
// account leaves this view automatically the moment its status is changed elsewhere.
import { ThumbsUp } from "lucide-react";
import { AccountStatusQueue } from "./domain/AccountStatusQueue";

export default function Interested() {
  return (
    <AccountStatusQueue
      tags={["Interested"]}
      title="Interested"
      description="Accounts currently marked Interested, with their open opportunity, deal value, and owner. Change status from here or the Account page to move it to another queue."
      icon={ThumbsUp}
    />
  );
}
