import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: "./",
    include: ["**/*.e2e-spec.ts"],
    // Refuses to run against a shared database / Redis DB 0 — see
    // test/support/e2e-guard.ts. CI (CI=true) is exempt.
    setupFiles: ["./test/support/e2e-setup.ts"],
    // The suites share one Postgres, one Redis DB and the GLOBAL `permissions`
    // table (several upsert the same permission code), so spec files must not
    // run in parallel workers: concurrent upserts of one code intermittently
    // failed with a unique-constraint error.
    fileParallelism: false,
  },
});
