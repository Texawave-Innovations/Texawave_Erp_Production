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

// The real `primary` variant classes from components/button/index.tsx.
const PRIMARY =
  "bg-linear-135 from-blue-600 via-brand-500 to-cyan-500 hover:from-blue-700 hover:via-brand-600 hover:to-cyan-600 text-white dark:bg-linear-135 dark:from-blue-600 dark:via-brand-500 dark:to-cyan-500";

test("a background colour replaces the variant gradient (tinted Edit/Delete buttons)", () => {
  const out = cn(
    PRIMARY,
    "h-8 text-theme-xs",
    "border border-sky-200 bg-sky-50/90 text-[#0284c7] dark:bg-sky-950/50",
  ).split(" ");
  assert.ok(out.includes("bg-sky-50/90"));
  for (const gone of [
    "bg-linear-135",
    "from-blue-600",
    "via-brand-500",
    "to-cyan-500",
    "dark:bg-linear-135",
    "dark:from-blue-600",
    "dark:via-brand-500",
    "dark:to-cyan-500",
  ]) {
    assert.ok(!out.includes(gone), `${gone} should have been replaced: ${out}`);
  }
  assert.ok(out.includes("text-[#0284c7]"), "label colour kept");
  assert.ok(!out.includes("text-white"), "variant white label replaced");
});

test("a solid colour override works (green, red, white call-site buttons)", () => {
  for (const bg of [
    "bg-emerald-600",
    "bg-red-600",
    "bg-white",
    "bg-[#1769F5]",
  ]) {
    const out = cn(PRIMARY, bg).split(" ");
    assert.ok(out.includes(bg));
    assert.ok(!out.includes("bg-linear-135"), `${bg} left the gradient`);
  }
});

test("without a colour override the gradient and white label are untouched", () => {
  const out = cn(PRIMARY, "h-8 text-theme-xs px-3").split(" ");
  for (const keep of [
    "bg-linear-135",
    "from-blue-600",
    "to-cyan-500",
    "text-white",
  ]) {
    assert.ok(out.includes(keep), `${keep} lost: ${out}`);
  }
});

test("hover and dark overrides stay scoped to their own modifier", () => {
  // A hover-only colour must not delete the resting gradient.
  const hoverOnly = cn(PRIMARY, "hover:bg-sky-100").split(" ");
  assert.ok(hoverOnly.includes("bg-linear-135"));
  assert.ok(hoverOnly.includes("hover:bg-sky-100"));
  // A dark-only colour must not delete the light-mode gradient.
  const darkOnly = cn(PRIMARY, "dark:bg-slate-800").split(" ");
  assert.ok(darkOnly.includes("bg-linear-135"));
  assert.ok(!darkOnly.includes("dark:bg-linear-135"));
});

test("a gradient passed later still wins over an earlier colour", () => {
  const out = cn("bg-white", "bg-linear-135 from-blue-600 to-cyan-500").split(
    " ",
  );
  assert.ok(out.includes("bg-linear-135"));
});
