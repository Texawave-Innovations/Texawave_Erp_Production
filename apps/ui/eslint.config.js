const shared = require("@texawave-erp/config/eslint.config.js");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  ...shared,
  {
    ignores: [".next/**"],
  },
  reactHooks.configs.flat["recommended-latest"],
  {
    // Frontend must never touch database internals directly (Phase 4). Paths
    // here are relative to apps/ui, since this file (not packages/config's)
    // is what ESLint resolves when linting this workspace.
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
                "@texawave-erp/database",
                "**/apps/api/**",
                "**/packages/database/**",
              ],
              message:
                "apps/ui must never import database/Prisma internals or apps/api code directly — go through the typed API client in packages/core instead.",
            },
          ],
        },
      ],
    },
  },
];
