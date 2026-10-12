# Menu catalogue

`menu_items` rows are **data**, not schema, so no Prisma migration creates them. Before this
mechanism the only source was `prisma/seed.ts`, which is local-dev only — staging and production
had no way to receive a new menu item short of a manual `POST /menu/items` call. This folder is
that way, mirroring `prisma/permissions/` for `MenuItem`.

| File          | Role                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.ts`  | The single, version-controlled menu tree (`MENU_CATALOG`). **Edit this.**                                                                                     |
| `validate.ts` | Structural rules (unique codes, resolvable `parentCode`, no cycles) and cross-checks every `permission` against `prisma/permissions/catalog.ts`. Pure, no DB. |
| `sync.ts`     | `syncMenuItems()` — makes one organization's menu tree match the catalogue, additively.                                                                       |
| `sync-cli.ts` | The command a deploy pipeline runs.                                                                                                                           |

One structural difference from permissions: `MenuItem` is per-organization and hierarchical. The
catalogue references a parent by its stable `code` (`parentCode`), and `sync.ts` resolves that to
the organization's actual numeric `parentId`, in topological order.

## Add a menu item

1. Add it to `catalog.ts` in the same PR as the page/route it points at. Set `permission` to an
   exact permission code, or a `scopedPermission()` family's prefix (e.g. `hr.task.write` matches
   anyone holding `.own`/`.team`/`.all`) — `validate.ts` rejects anything not in
   `prisma/permissions/catalog.ts`.
2. `pnpm --filter @texawave-erp/database menu:sync` locally.
3. Grant the gating permission to roles in Settings → Roles — sync never grants anything to anyone.

## Deploy (every environment)

Run **after** `permissions:sync`, since a menu item's permission must already exist:

```bash
pnpm --filter @texawave-erp/database exec prisma migrate deploy
pnpm --filter @texawave-erp/database permissions:sync
pnpm --filter @texawave-erp/database menu:sync:dry   # optional: show the plan
pnpm --filter @texawave-erp/database menu:sync
```

It prints the target host/database (never credentials), applies the catalogue to every active
organization, takes a per-organization Postgres advisory lock (two nodes starting together
serialise), and runs each organization in its own transaction. Exit code is non-zero on an invalid
catalogue or any failure. `menu:check` validates the catalogue without a database.

## Guarantees (what "non-destructive" means here)

- Inserts missing rows and refreshes `label`/`path`/`order`/`permission`/`parentId` — nothing else
  about a catalogue item.
- **Never deletes or soft-deletes** a row.
- **Never re-activates** an item that was disabled (`is_active = false`); it is reported as "kept
  inactive" — an administrator may have disabled it on purpose.
- An item that drops out of the catalogue, or was created by hand (e.g. via `POST /menu/items`),
  becomes an **orphan**: reported, left exactly as it is, never removed.
- Idempotent: a second run reports `unchanged` and writes nothing.

## Tests

`pnpm --filter @texawave-erp/database test` runs the validation and sync tests (in-memory).
`sync.db.test.ts` additionally checks the real behaviour against Postgres, but **only** when
`TEST_DATABASE_URL` is set (to a disposable database with migrations applied) — it is skipped
otherwise so `turbo run test` can never write to a shared database.
