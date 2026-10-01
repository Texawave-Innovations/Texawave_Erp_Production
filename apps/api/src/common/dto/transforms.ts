import { Transform } from "class-transformer";

/** Trims a string input; leaves every other type for the validators to reject. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  );

/** Trims and upper-cases (codes are stored upper-case: `eng` → `ENG`). */
export const UpperTrim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  );

/** Query-string booleans arrive as the strings "true"/"false"; anything else
 * is passed through so `@IsBoolean()` rejects it (no silent truthiness). */
export const QueryBoolean = () =>
  Transform(({ value }: { value: unknown }) =>
    value === "true" ? true : value === "false" ? false : value,
  );

/** The shape every master-data code must have (mirrored by a DB CHECK). */
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;
export const CODE_MESSAGE =
  "code must be 2-30 characters: upper-case letters, digits or underscore, starting with a letter";
