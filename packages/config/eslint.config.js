const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const globals = require("globals");
const importX = require("eslint-plugin-import-x");
const eslintComments = require("@eslint-community/eslint-plugin-eslint-comments");

module.exports = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "import-x": importX,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Forbidden/duplicate imports (Phase 5) — deliberately NOT spreading
      // import-x's full "recommended" config here: no-unresolved/named/namespace
      // need a working resolver for every path alias + workspace `exports` map
      // in this repo, which hasn't been set up and would produce noisy false
      // positives. Add resolver config and broaden this if that changes.
      "import-x/no-duplicates": "error",
      "import-x/no-cycle": [
        "error",
        { maxDepth: Infinity, ignoreExternal: true },
      ],
      // A bare `eslint-disable` with no explanation is not a routine fix —
      // see CLAUDE.md "Non-negotiables" and CODING_STANDARDS.md §15.
      "@eslint-community/eslint-comments/require-description": [
        "error",
        { ignore: [] },
      ],
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/no-unused-disable": "error",
      "@eslint-community/eslint-comments/disable-enable-pair": "error",
    },
  },
  {
    files: ["**/*.config.js", "**/.*rc.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Package-boundary rules (Phase 4): packages/* are consumed by apps/*, never
  // the reverse, and only packages/database may touch the Prisma client
  // directly. These `files` globs are relative to whichever eslint.config.js
  // resolves them — safe here because packages/core, packages/api-types,
  // packages/ui-kit and packages/database have no eslint.config.js of their
  // own, so this file is always the one ESLint resolves for them (verified:
  // `pnpm --filter <pkg> lint` walks up to this file). apps/api and apps/ui
  // have their own local eslint.config.js that re-declares app-specific
  // restrictions using paths relative to themselves instead.
  {
    files: ["packages/**/*.{ts,tsx}"],
    ignores: ["packages/database/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/*/**", "**/apps/*"],
              message:
                "packages/* must never depend on apps/* — shared code has to work standalone. Move the shared logic into a package instead.",
            },
            {
              group: [
                "@prisma/client",
                "@prisma/client/*",
                "**/generated/prisma/**",
                "@texawave-erp/database/generated/*",
              ],
              message:
                "Only packages/database may import Prisma internals directly (it owns the schema/client). Import the typed exports from @texawave-erp/database instead.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
