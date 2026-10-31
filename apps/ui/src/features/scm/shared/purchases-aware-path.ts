/**
 * Procurement screens (RequisitionsView, QuotationsView, ...) cross-link to
 * sibling screens (e.g. "Create RFQ" from a requisition, "Compare" from a
 * quotation). Those screens are rendered at two different routes — their own
 * standalone `/scm/procurement/*` page, and embedded as a tab inside
 * features/purchases/components/PurchasesView at `/purchases?tab=...`. A
 * hardcoded `/scm/procurement/...` target would jump a user out of the
 * Purchases tabbed shell back to the standalone SCM pages, defeating the
 * point of the tabs. This keeps the link inside whichever shell the user is
 * currently in.
 */
export function purchasesAwarePath(
  pathname: string,
  purchasesTab: string,
  scmPath: string,
  query: string,
): string {
  const base = pathname.startsWith("/purchases")
    ? `/purchases?tab=${purchasesTab}`
    : scmPath;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${query}`;
}

/**
 * After a screen consumes a one-time query param (e.g. `?fromRequisition=1`
 * prefilling a create form), it resets its own URL to strip that param. A
 * plain hardcoded reset (e.g. to `/scm/procurement/rfqs`) would, when this
 * screen is embedded under the Purchases tabbed shell at
 * `/purchases?tab=rfqs`, drop the `tab` param too and bounce the user back to
 * the default (Vendors) tab. This strips only the named param(s), keeping
 * `pathname` and every other query param (including `tab`) intact.
 */
export function withoutQueryParams(
  pathname: string,
  params: URLSearchParams,
  keys: readonly string[],
): string {
  const next = new URLSearchParams(params);
  for (const key of keys) next.delete(key);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
