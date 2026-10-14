#!/usr/bin/env node
// Groups Vitest's coverage/coverage-summary.json by module and prints a
// Markdown table (also written to coverage/modules.md).
//
//   pnpm --filter api test:cov:modules
//
// "Logic lines %" counts only service/rules/helper files — controllers,
// Nest *.module.ts, repositories and DTOs are excluded because unit tests
// mock them out and the e2e suite (test/*.e2e-spec.ts) is what exercises
// them. That's the column the unit-test target in
// Docs/CODING_STANDARDS.md §14 applies to.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOGIC_TARGET = 70;
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath = path.join(apiRoot, "coverage", "coverage-summary.json");

if (!fs.existsSync(summaryPath)) {
  console.error(
    `No coverage summary at ${summaryPath} — run \`pnpm --filter api test:cov\` first.`,
  );
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const srcRoot = path.join(apiRoot, "src");

// Folders whose children are separate modules (modules/hr/attendance, ...).
const NESTED = new Set([
  "modules/hr",
  "modules/master-data",
  "modules/settings",
  "modules/employee-self-service",
  "modules/_reference",
  "platform",
  "common",
  "shared",
]);

function moduleOf(rel) {
  const parts = rel.split("/");
  const dirs = parts.slice(0, -1);
  for (let depth = Math.min(dirs.length, 2); depth >= 1; depth--) {
    const parent = dirs.slice(0, depth).join("/");
    if (NESTED.has(parent) && dirs.length > depth) {
      return dirs.slice(0, depth + 1).join("/");
    }
  }
  if (dirs[0] === "modules" && dirs.length > 1) return dirs.slice(0, 2).join("/");
  return dirs.length ? dirs[0] : "(src root)";
}

function isWrapper(rel) {
  return (
    /\.(controller|module|repository)\.ts$/.test(rel) || /(^|\/)dto(\/|\.ts$)|\.dto\.ts$/.test(rel)
  );
}

const empty = () => ({ covered: 0, total: 0 });
const groups = new Map();

for (const [file, data] of Object.entries(summary)) {
  if (file === "total") continue;
  const rel = path.relative(srcRoot, file).split(path.sep).join("/");
  const key = moduleOf(rel);
  if (!groups.has(key)) {
    groups.set(key, {
      files: 0,
      lines: empty(),
      branches: empty(),
      functions: empty(),
      logic: empty(),
    });
  }
  const g = groups.get(key);
  g.files++;
  for (const metric of ["lines", "branches", "functions"]) {
    g[metric].covered += data[metric].covered;
    g[metric].total += data[metric].total;
  }
  if (!isWrapper(rel)) {
    g.logic.covered += data.lines.covered;
    g.logic.total += data.lines.total;
  }
}

const pct = ({ covered, total }) => (total ? (100 * covered) / total : null);
const fmt = (m) => {
  const p = pct(m);
  return p === null ? "—" : p.toFixed(1);
};

const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
const lines = [
  `| Module | Files | Lines % | Branches % | Functions % | Logic lines % | Lines covered |`,
  `|---|---:|---:|---:|---:|---:|---:|`,
];
const below = [];
for (const [name, g] of rows) {
  const logic = pct(g.logic);
  const flag = logic !== null && logic < LOGIC_TARGET ? " ⚠" : "";
  if (flag) below.push(name);
  lines.push(
    `| ${name} | ${g.files} | ${fmt(g.lines)} | ${fmt(g.branches)} | ${fmt(g.functions)} | ${fmt(g.logic)}${flag} | ${g.lines.covered}/${g.lines.total} |`,
  );
}
const t = summary.total;
lines.push(
  `| **Total** | ${rows.reduce((n, [, g]) => n + g.files, 0)} | ${fmt(t.lines)} | ${fmt(t.branches)} | ${fmt(t.functions)} | | ${t.lines.covered}/${t.lines.total} |`,
);
lines.push(
  "",
  `⚠ = logic (service/rules/helper) line coverage below the ${LOGIC_TARGET}% unit-test target.`,
  below.length ? `Below target: ${below.join(", ")}` : "All modules meet the logic-coverage target.",
);

const out = lines.join("\n");
fs.writeFileSync(path.join(apiRoot, "coverage", "modules.md"), out + "\n");
console.log(out);
