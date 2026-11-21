import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Guard for colour classes that point at a shade the theme does not have.
 *
 * Tailwind emits NO css for `dark:bg-slate-850` when there is no slate-850,
 * so the element silently keeps its light-mode colour in dark mode (a table
 * header that faded to light grey on the right, white hover rows, ...). Tailwind's
 * palette has 50, 100-900 and 950 only; anything else (25, 150, 750, 850, 755...)
 * must be declared as `--color-<palette>-<shade>` in packages/ui-kit/src/theme.css.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_SRC = path.resolve(HERE, "..");
const UI_KIT_SRC = path.resolve(HERE, "../../../../packages/ui-kit/src");

const STANDARD = new Set([
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
]);
const PALETTES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];
const UTILITIES =
  "bg|text|border|from|via|to|ring|fill|stroke|divide|outline|shadow|accent|placeholder|decoration";
const CLASS = new RegExp(
  `(?<![\\w-])(?:[a-z0-9\\[\\]-]+:)*(?:${UTILITIES})-(${PALETTES.join("|")})-(\\d+)(?:/\\d+)?`,
  "g",
);

function declaredShades(): Set<string> {
  const theme = readFileSync(path.join(UI_KIT_SRC, "theme.css"), "utf8");
  return new Set(
    [...theme.matchAll(/--color-([a-z]+)-(\d+):/g)].map(
      (m) => `${m[1]}-${m[2]}`,
    ),
  );
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .filter((f) => !f.endsWith(".test.ts"))
    .map((f) => path.join(root, f));
}

function undefinedShades(): string[] {
  const declared = declaredShades();
  const found = new Set<string>();
  for (const file of [...sourceFiles(UI_SRC), ...sourceFiles(UI_KIT_SRC)]) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(CLASS)) {
      const palette = m[1]!;
      const shade = Number(m[2]);
      if (STANDARD.has(shade) || declared.has(`${palette}-${shade}`)) continue;
      found.add(`${palette}-${shade}  (${path.relative(UI_SRC, file)})`);
    }
  }
  return [...found].sort();
}

test("every colour shade used in a class exists in the theme", () => {
  assert.deepEqual(
    undefinedShades(),
    [],
    "Declare the shade as --color-<palette>-<shade> in packages/ui-kit/src/theme.css, or use a standard shade (Docs/DESIGN_SYSTEM.md §3.4).",
  );
});

test("the in-between dark surfaces are declared", () => {
  const declared = declaredShades();
  for (const shade of ["gray-750", "gray-850", "slate-750", "slate-850"]) {
    assert.ok(declared.has(shade), `${shade} missing from theme.css`);
  }
});

test("the guard's pattern recognises an undefined shade", () => {
  const sample =
    'className="dark:hover:bg-slate-755 from-sky-200/80 dark:to-gray-850"';
  const shades = [...sample.matchAll(CLASS)].map((m) => `${m[1]}-${m[2]}`);
  assert.deepEqual(shades, ["slate-755", "sky-200", "gray-850"]);
});
