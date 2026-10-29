/** First segment (after the organization) of every Sales query key, so a
 * Sales mutation can invalidate everything Sales shows in one call. */
export const SALES_KEY = "sales" as const;
