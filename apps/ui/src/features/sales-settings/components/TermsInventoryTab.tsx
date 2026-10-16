"use client";

import { MasterListCard } from "./MasterListCard";

/** "Terms & Inventory" top-level tab — 8 identical add/delete chip cards. */
export function TermsInventoryTab() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <MasterListCard category="payment_term" title="Payment Terms" />
      <MasterListCard category="delivery_term" title="Delivery Terms" />
      <MasterListCard category="dispatch_mode" title="Dispatch Modes" />
      <MasterListCard category="gst_rate" title="GST Rates" showNumericValue />
      <MasterListCard category="item_category" title="Item Categories" />
      <MasterListCard category="item_type" title="Item Types" />
      <MasterListCard category="item_group" title="Item Groups" />
      <MasterListCard category="unit" title="Units" />
    </div>
  );
}
