module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test"],
    ],
    "scope-empty": [2, "never"],
    // Frozen list — see Docs/CODING_STANDARDS.md §2's "Commits" row and
    // CLAUDE.md's "Working on this repo for the first time" section for the
    // full rationale. New scopes are a PR to this file on its own (shared
    // tooling config, needs its own review — see root CLAUDE.md's "needs
    // review before merge" list), not a silent addition inside an
    // unrelated feature PR.
    "scope-enum": [
      2,
      "always",
      [
        // apps/* and packages/* already scoped to in real commit history.
        "api",
        "ui",
        "ui-kit",
        "database",
        "platform",
        "reference",
        // Cross-cutting/tooling scopes already in use.
        "docs",
        "ci",
        "config",
        "infra",
        // One-time Phase 0 bootstrap scopes (see e.g. "chore(apps): bootstrap
        // apps/api, apps/ui, apps/mobile") — kept only so that history stays
        // valid under a retroactive `commitlint --from <sha>` pass, not
        // meant to be reused now that per-package scopes exist.
        "apps",
        "packages",
        "repo",
        // Anticipated, not used yet — Epic 1 (login/forgot-password, RBAC
        // CRUD) and Epic 2 (dynamic menu) work.
        "auth",
        "rbac",
        "tenancy",
        "organizations",
        "users",
        "roles",
        "permissions",
        "departments",
        "teams",
        "menu",
        "deps",
      ],
    ],
    "scope-case": [2, "always", "lower-case"],
  },
};
