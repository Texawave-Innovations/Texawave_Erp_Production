const { spawn } = require("child_process");
const path = require("path");

const financePatterns = [
  "src/modules/finance",
  "src/modules/finance-settings",
  "src/modules/scm/finance",
  "test/finance-core-model-rules.spec.ts",
];

const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = [
  "--filter",
  "api",
  "exec",
  "vitest",
  "run",
  ...financePatterns,
  "--reporter=verbose",
  "--reporter=json",
  "--outputFile=scratch/finance_test_results.json",
];

console.log("Running Finance test suites:", args.join(" "));
const p = spawn(cmd, args, { stdio: "inherit", shell: true });

p.on("close", (code) => {
  console.log(`Vitest execution finished with code: ${code}`);
  process.exit(code);
});
