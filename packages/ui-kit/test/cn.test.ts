import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cn, CUSTOM_FONT_SIZES } from "../src/lib/cn.js";

/**
 * Regression guard for "dark text on a blue button": tailwind-merge treated
 * the custom `text-theme-xs` / `text-theme-sm` sizes as colours and silently
 * dropped the variant's `text-white`.
 */

const themeCss = readFileSync(
  new URL("../src/theme.css", import.meta.url),
  "utf8",
);

/** `--text-theme-xs: 12px;` → "theme-xs" (line-height companions excluded). */
function declaredFontSizeTokens(): string[] {
  const names = [...themeCss.matchAll(/^\s*--text-([a-z0-9-]+):/gm)].map(
    (m) => m[1]!,
  );
  return names.filter((n) => !n.includes("--"));
}

test("every --text-* size token in theme.css is registered in cn()", () => {
  const declared = declaredFontSizeTokens();
  assert.ok(declared.length > 0, "found no --text-* tokens in theme.css");
  const registered = new Set<string>(CUSTOM_FONT_SIZES);
  const missing = declared.filter((n) => !registered.has(n));
  assert.deepEqual(
    missing,
    [],
    `Register ${missing.join(", ")} in CUSTOM_FONT_SIZES (packages/ui-kit/src/lib/cn.ts), ` +
      "otherwise cn() drops text colour classes next to them.",
  );
});

for (const size of CUSTOM_FONT_SIZES) {
  test(`cn keeps text-white next to text-${size}`, () => {
    const out = cn("bg-brand-500 text-white", `h-8 text-${size}`).split(" ");
    assert.ok(out.includes("text-white"), `text-white dropped: ${out}`);
    assert.ok(out.includes(`text-${size}`), `text-${size} dropped: ${out}`);
  });
}

test("a later text colour still overrides an earlier one", () => {
  assert.equal(cn("text-white", "text-red-500"), "text-red-500");
});

test("a later font size still overrides an earlier custom one", () => {
  assert.equal(cn("text-theme-sm", "text-xs"), "text-xs");
  assert.equal(cn("text-xs", "text-theme-sm"), "text-theme-sm");
});

test("Button-style composition keeps white label colour", () => {
  const out = cn(
    "inline-flex rounded-xl font-medium",
    "bg-linear-135 from-blue-600 text-white",
    "h-8 px-3.5 text-theme-xs gap-1.5",
    "w-20.5 h-7 px-1.5 text-xs font-semibold",
  ).split(" ");
  assert.ok(out.includes("text-white"));
});
