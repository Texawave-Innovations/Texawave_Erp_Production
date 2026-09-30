# Permission catalogue

`permissions` rows are **data**, not schema, so no Prisma migration creates them. Before this
mechanism the only source was `prisma/seed.ts`, which is local-dev only — staging and production
had no way to receive a new permission. This folder is that way.

| File          | Role                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.ts`  | The single, version-controlled list of permissions (`PERMISSION_CATALOG`) and retired ones (`RETIRED_PERMISSIONS`). **Edit this.** |
| `validate.ts` | Naming (`Docs/CODING_STANDARDS.md` §2a) and scope-completeness rules. Pure, no DB.                                                 |
| `sync.ts`     | `syncPermissions()` — makes the DB match the catalogue, additively.                                                                |
| `sync-cli.ts` | The command a deploy pipeline runs.                                                                                                |

## Add a permission

1. Add it to `catalog.ts` in the same PR as the code that checks it. Team-scoped data uses
   `...scopedPermission("hr.employee.read", "View employees")` — all of `.own`/`.team`/`.all`
   are required together (`validate.ts` rejects a partial set).
2. `pnpm --filter @texawave-erp/database permissions:sync` locally.
3. Grant it to roles in Settings → Roles. Sync never grants anything to anyone.

## Deploy (every environment)

Run **after** `prisma migrate deploy`, as its own pipeline step:

```bash
pnpm --filter @texawave-erp/database exec prisma migrate deploy
pnpm --filter @texawave-erp/database permissions:sync:dry   # optional: show the plan
pnpm --filter @texawave-erp/database permissions:sync
```

It prints the target host/database (never credentials), takes a Postgres advisory lock (two nodes
starting together serialise), and runs in one transaction. Exit code is non-zero on an invalid
catalogue or any failure. `permissions:check` validates the catalogue without a database.

## Guarantees (what "non-destructive" means here)

- Inserts missing rows and refreshes `description` text — nothing else about a catalogue permission.
- **Never deletes** a row. **Never touches** `roles`, `role_permissions` or `user_roles`.
- **Never re-activates** a permission that was disabled (`is_active = false`); it is reported as
  "kept inactive" — an administrator may have disabled it on purpose.
- Deactivates only codes listed in `RETIRED_PERMISSIONS` (with a reason). Moving a permission out
  of the catalogue without retiring it just makes it an "orphan": reported, left as it is.
- Idempotent: a second run reports `unchanged` and writes nothing.

## Tests

`pnpm --filter @texawave-erp/database test` runs the validation and sync tests (in-memory).
`sync.db.test.ts` additionally checks the real behaviour against Postgres, but **only** when
`TEST_DATABASE_URL` is set (to a disposable database with migrations applied) — it is skipped
otherwise so `turbo run test` can never write to a shared database.
