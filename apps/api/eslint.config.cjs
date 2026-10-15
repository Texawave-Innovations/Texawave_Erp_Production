const fs = require("node:fs");
const path = require("node:path");
const tseslint = require("typescript-eslint");
const importX = require("eslint-plugin-import-x");
const shared = require("@texawave-erp/config/eslint.config.js");

const MODULES_DIR = path.join(__dirname, "src/modules");
const moduleNames = fs.existsSync(MODULES_DIR)
  ? fs
      .readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

// One zone per module (Phase 4: "feature modules must not import another
// module's private repository"). Generated from the filesystem so this stays
// correct as modules are added/removed — nobody has to remember to update an
// allowlist by hand. A module may still import its OWN repository files; the
// zone below only forbids reaching into a *sibling* module's repository.
const modulePrivacyZones = moduleNames
  .map((name) => ({
    target: `./src/modules/${name}/**/*`,
    from: moduleNames
      .filter((other) => other !== name)
      .map((other) => `./src/modules/${other}/**/*.repository.ts`),
    message:
      "A module may not import another module's repository directly — use EventEmitter2 for async side effects, or a module's exported public service for a necessary synchronous read (see CODING_STANDARDS.md §11).",
  }))
  // A module with no siblings yet has nothing to restrict against — the
  // rule's schema rejects an empty `from` array, and it would be a no-op
  // anyway.
  .filter((zone) => zone.from.length > 0);

module.exports = tseslint.config(
  ...shared,
  {
    // Legacy reference-only source trees (copied verbatim from the old
    // Firebase/Vite app for migration-audit purposes, never meant to build
    // or run here) — excluded from tsconfig.json/tsconfig.build.json's
    // `include` for the same reason, so typescript-eslint's project
    // service has nowhere to place them and fails to parse every file
    // otherwise. Keep this list in sync with those two tsconfig excludes.
    ignores: [
      "src/modules/crm/*.tsx",
      "src/modules/crm/bulkImport/**",
      "src/modules/crm/celebration/**",
      "src/modules/crm/components/**",
      "src/modules/crm/domain/**",
      "src/modules/crm/importExport/**",
      "src/modules/crm/intelligence/**",
      "src/modules/crm/notifications/**",
      "src/modules/crm/types.ts",
      "src/modules/crm/useOverallDataLive.ts",
      "src/modules/finance/**",
      "src/modules/projects/**",
      "src/modules/sales/**",
      "src/modules/scm/**",
    ],
  },
  {
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      "import-x/resolver": { node: { extensions: [".js", ".ts"] } },
    },
    rules: {
      // Type-aware rules (Phase 5): unsafe `any`/casts and unhandled promises
      // are exactly the two classes of bug that silent-any and fire-and-forget
      // async calls produce in a NestJS request pipeline.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "import-x/no-cycle": ["error", { maxDepth: Infinity, ignoreExternal: true }],
    },
  },
  {
    // Controllers must not query Prisma (Phase 6 / CODING_STANDARDS.md §3):
    // route through the service, which routes through the repository.
    files: ["src/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@prisma/client/*",
                "**/generated/prisma/**",
                "@texawave-erp/database/generated/*",
                "**/shared/prisma/**",
              ],
              message:
                "Controllers must not touch Prisma or PrismaService directly — call the service, which calls the repository.",
            },
          ],
        },
      ],
    },
  },
  {
    // Only *.repository.ts files (and the shared Prisma provider itself) may
    // call PrismaService — CODING_STANDARDS.md §3.
    files: ["src/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@prisma/client/*", "**/generated/prisma/**"],
              message:
                "Services must not import Prisma directly — that's the repository's job. Inject the repository instead.",
            },
          ],
        },
      ],
    },
  },
  ...(modulePrivacyZones.length > 0
    ? [
        {
          files: ["src/modules/**/*.ts"],
          rules: {
            "import-x/no-restricted-paths": [
              "error",
              { zones: modulePrivacyZones, basePath: __dirname },
            ],
          },
        },
      ]
    : []),
);
