import type { Locator } from "@playwright/test";

/**
 * `packages/ui-kit/src/components/select` renders a glassmorphism combobox:
 * a hidden native `<select>` (for form semantics) plus a visible
 * `role="combobox"` trigger button. Whether that button also carries the
 * field's accessible name depends on how the caller wired it up:
 *
 * - Some forms pass `aria-label` straight through to `Select`, so both the
 *   native select and the visible button share one name — `getByLabel`
 *   resolves to 2 elements and Playwright's strict mode rejects it.
 * - Others (e.g. ScmFormDialog's generic `fields` renderer) associate the
 *   label with the native select only via `<label htmlFor>`, leaving the
 *   visible button unnamed — `getByLabel` resolves to exactly 1 element (the
 *   select) and a plain `.selectOption()` on it works fine, since its
 *   `onChange` is wired directly to the same handler the visible button
 *   uses.
 *
 * This tries the simple path first and only falls back to clicking the
 * visible trigger + portal-rendered option when the label is ambiguous.
 */
export async function selectCombobox(
  scope: Locator,
  name: string | RegExp,
  optionName: string,
): Promise<void> {
  const byLabel = scope.getByLabel(name);
  const count = await byLabel.count();
  if (count === 1) {
    await byLabel.selectOption({ label: optionName });
    return;
  }
  await scope.getByRole("combobox", { name }).click();
  await scope
    .page()
    .getByRole("option", { name: optionName, exact: true })
    .click();
}
