import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

/**
 * Business dates (joining date, holiday, leave range, shift effective range)
 * are calendar dates with no time zone — never timestamps. On the wire they
 * are `"YYYY-MM-DD"` strings; in the database `DATE`; in code a `Date` at
 * 00:00:00 UTC, so no local-time-zone arithmetic can shift the day.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnlyString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_ONLY.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // Rejects 2026-02-30 (JS would roll it into March) and year 0000.
  return (
    Number(y) >= 1900 &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/** `"2026-09-30"` → `Date` at 2026-09-30T00:00:00.000Z. Throws on anything else. */
export function parseDateOnly(value: string): Date {
  if (!isDateOnlyString(value)) {
    throw new Error(`Not a valid YYYY-MM-DD date: ${String(value)}`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

/** `Date` (as read from a Postgres `DATE`) → `"YYYY-MM-DD"`. */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to`, inclusive (same day → 1). */
export function inclusiveDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** class-validator decorator: the value must be a real `YYYY-MM-DD` date. */
export function IsDateOnly(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: "isDateOnly",
      target: target.constructor,
      propertyName,
      ...(options ? { options } : {}),
      validator: {
        validate: (value: unknown) => isDateOnlyString(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid calendar date in YYYY-MM-DD format`,
      },
    });
  };
}
