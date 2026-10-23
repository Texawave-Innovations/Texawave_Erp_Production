/**
 * The chip-add UI (MasterListCard) collects only a free-text name, but
 * Designations/Office Locations/Leave Types/Shifts all require an immutable
 * `code` matching `CODE_PATTERN` (apps/api/src/common/dto/transforms.ts:
 * starts with a letter, then A-Z0-9_, 2-30 chars total). This derives a
 * reasonable code from the entered name so the add form can stay a single
 * input, matching the screenshot's chip-list UI.
 *
 * Judgment call (flagged for review): the backend owns `code` uniqueness —
 * if two different names collapse to the same derived code, the create call
 * fails and the user sees the generic "Could not add this item" toast. This
 * mirrors the existing Designations admin screen behavior, not a new rule.
 */
export function deriveCode(name: string, maxLength = 30): string {
  let code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!/^[A-Z]/.test(code)) {
    code = `X${code}`;
  }
  code = code.slice(0, maxLength);
  if (code.length < 2) {
    code = `${code}X`.slice(0, maxLength);
  }
  return code;
}
