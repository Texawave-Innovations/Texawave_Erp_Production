import { remove } from "firebase/database";
import { database, ref, runTransaction } from "@/services/firebase";
import { firebaseKey } from "../inventory/inventoryPaths";

const ACTION_LOCKS_PATH = "scm/actionLocks";

/** Locks older than this are treated as abandoned (the tab that took them crashed). */
const STALE_LOCK_MS = 60 * 1000;

/**
 * Runs `fn` while holding an exclusive lock on `key`, so a double click or a second tab can't
 * run the same create action concurrently. `fn` must re-read fresh state and re-validate — the
 * lock only serializes callers, it doesn't make a stale in-memory copy safe.
 */
export async function withActionLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockRef = ref(database, `${ACTION_LOCKS_PATH}/${firebaseKey(key)}`);
  const result = await runTransaction(lockRef, (current: number | null) => {
    if (current !== null && Date.now() - current < STALE_LOCK_MS) return; // abort — held
    return Date.now();
  });
  if (!result.committed)
    throw new Error(
      "This action is already in progress in another window. Refresh in a moment.",
    );
  try {
    return await fn();
  } finally {
    await remove(lockRef).catch(() => undefined);
  }
}
