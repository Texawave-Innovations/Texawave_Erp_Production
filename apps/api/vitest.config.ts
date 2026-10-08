import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["**/*.spec.ts"],
    // Only applies when coverage is enabled (`pnpm --filter api test:cov`).
    // `include` lists every source file, not just the ones a test happens to
    // import, so an untested module shows up as 0% instead of disappearing
    // from the report. `scripts/coverage-report.mjs` groups the json-summary
    // output by module — see Docs/CODING_STANDARDS.md §14.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/main.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
