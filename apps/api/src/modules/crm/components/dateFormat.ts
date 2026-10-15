// Shared `yyyy-MM-dd` <-> local `Date` conversion for DatePicker.tsx and DateTimePicker.tsx — both
// build on the app's themed Calendar popover instead of the native date input, and both need the
// exact same local-date (not UTC) parsing/formatting for their day portion. Kept in one place so a
// fix (e.g. the invalid-input guard below) can't be present in one picker and missing in the other.

/** Brand-green (ERP theme) accent overrides for the shared shadcn `Calendar`, merged on top of its
 *  own defaults (see `components/ui/calendar.tsx`) — passed only from DatePicker/DateTimePicker so
 *  every other, non-CRM use of that shared component elsewhere in the app is unaffected.
 *
 *  Deliberately does NOT use react-day-picker's built-in `captionLayout="dropdown"` month/year
 *  selects — without importing its own base CSS (this project styles Calendar purely via Tailwind
 *  classNames), that mode renders a visible native `<select>` stacked on top of its own duplicate
 *  text label instead of overlaying it, which looked broken. The year-jump buttons next to the
 *  plain text caption in DatePicker/DateTimePicker are a plain custom control instead. */
export const BRAND_CALENDAR_CLASSNAMES = {
  caption_label: "text-sm font-bold text-slate-800",
  nav_button:
    "h-7 w-7 bg-transparent p-0 text-brand-600 hover:bg-brand-100 hover:text-brand-700 rounded-lg transition-colors",
  head_cell: "text-brand-600 font-semibold rounded-md w-9 text-[0.8rem]",
  day_selected:
    "bg-brand-500 text-white hover:bg-brand-600 hover:text-white focus:bg-brand-500 focus:text-white font-bold",
  day_today: "bg-brand-50 text-brand-700 border border-brand-200 font-bold",
};
export const pad = (n: number): string => String(n).padStart(2, "0");

/** Formats a `Date` as `yyyy-MM-dd` using its LOCAL calendar fields (never UTC). */
export function toIsoDate(date: Date | undefined): string {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a `yyyy-MM-dd` string into a local `Date` via the (y, m, d) numeric constructor overload
 *  — avoids the UTC-midnight shift a plain `new Date(string)` would apply. Returns `undefined` for
 *  a blank or malformed value instead of an Invalid Date. */
export function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Formats a `Date`'s day portion as `dd-mm-yyyy` for display in the trigger button — shared by
 *  DatePicker and DateTimePicker so a future display-format change (e.g. locale) can't land in
 *  one and be missed in the other. */
export function formatDisplayDate(date: Date | undefined): string {
  if (!date) return "";
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}
