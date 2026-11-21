import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Guard for the page-header banner actions.
 *
 * A banner action button must use a Button variant (`glass` for the frosted
 * white look, or `primary`/`secondary`), never hand-written translucent
 * classes like `bg-white/20 text-white border-white/30`. The `.banner-actions`
 * CSS in theme.css restyles banner buttons, but skips any button whose class
 * list contains `from-` (every `primary` Button does). So a hand-written
 * translucent button looked white on some screens and see-through on others.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Index just after the `}` that closes the `{` at `start`. */
function braceEnd(s: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return s.length;
}

/** Index just after the `>` that closes the JSX tag starting at `start`. */
function tagEnd(s: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return i + 1;
  }
  return s.length;
}

const HAND_STYLED = /(?<![\w:-])(?:bg|border)-white\/\d+/;

function offenders(): string[] {
  const found: string[] = [];
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(SRC, f));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (!/<(Hr)?PageHeader\b/.test(source)) continue;
    for (const m of source.matchAll(/\baction=\{/g)) {
      const open = m.index! + m[0].length - 1;
      const block = source.slice(open, braceEnd(source, open));
      for (const b of block.matchAll(/<Button\b/g)) {
        const tag = block.slice(b.index!, tagEnd(block, b.index!));
        if (HAND_STYLED.test(tag)) {
          const line = source.slice(0, open + b.index!).split("\n").length;
          found.push(`${path.relative(SRC, file)}:${line}`);
        }
      }
    }
  }
  return found;
}

test("banner action buttons use a Button variant, not hand-written translucent white", () => {
  assert.deepEqual(
    offenders(),
    [],
    'Use variant="glass" for banner buttons instead of bg-white/N / border-white/N classes (Docs/DESIGN_SYSTEM.md §3.15).',
  );
});

test("the guard itself detects the bad pattern", () => {
  assert.ok(HAND_STYLED.test('className="bg-white/20 text-white"'));
  assert.ok(HAND_STYLED.test('className="gap-2 border-white/30"'));
  assert.ok(!HAND_STYLED.test('className="hover:bg-white"'));
  assert.ok(!HAND_STYLED.test('variant="glass" className="gap-2"'));
});
