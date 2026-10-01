import { Transform } from "class-transformer";

/** Trims and lower-cases a string (e-mail addresses). */
export const LowerTrim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  );

/** Empty / whitespace-only strings become `null` — "clear this optional
 * field" — instead of failing later on a CHECK constraint. */
export const BlankToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  );
