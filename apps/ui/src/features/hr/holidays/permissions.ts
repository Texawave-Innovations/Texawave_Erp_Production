/**
 * UI visibility only. The API guards every route and is authoritative.
 *
 * Holidays are organization-wide reference data (every employee may read
 * them), so these are flat permissions — no `.own/.team/.all` scoping.
 */
export const READ = "hr.holiday.read";
export const WRITE = "hr.holiday.write";
