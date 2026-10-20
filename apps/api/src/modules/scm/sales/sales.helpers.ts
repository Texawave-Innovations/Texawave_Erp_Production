export interface SoLine {
  id: number;
  salesQty: number;
}

export interface FulfillmentSlice {
  status: string;
  items: { salesOrderItemId: number; orderedQty: number; issuedQty: number }[];
}

/** Quantity of a fulfillment line that still counts against its sales-order
 * line: a finished fulfillment only consumes what it actually issued (so a
 * short-picked remainder can be fulfilled again); an open one consumes
 * everything it was created for. */
function consumed(
  f: FulfillmentSlice,
  item: FulfillmentSlice["items"][number],
) {
  return f.status === "FULFILLED" ? item.issuedQty : item.orderedQty;
}

/** Remaining (not yet claimed) quantity per sales-order line id, after every
 * non-cancelled fulfillment of the order. Pure — shared by fulfillment
 * creation and the sales-order views so they can never disagree. */
export function computeRemainingByLine(
  lines: SoLine[],
  fulfillments: FulfillmentSlice[],
): Map<number, number> {
  const remaining = new Map<number, number>(
    lines.map((l) => [l.id, l.salesQty]),
  );
  for (const f of fulfillments) {
    if (f.status === "CANCELLED") continue;
    for (const item of f.items) {
      if (!remaining.has(item.salesOrderItemId)) continue;
      remaining.set(
        item.salesOrderItemId,
        (remaining.get(item.salesOrderItemId) ?? 0) - consumed(f, item),
      );
    }
  }
  for (const [id, left] of remaining) remaining.set(id, Math.max(0, left));
  return remaining;
}
