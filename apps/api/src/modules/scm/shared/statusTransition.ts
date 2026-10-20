import {
  database,
  ref,
  runTransaction,
  updateRecord,
} from "@/services/firebase";
import { formatStatusLabel } from "./format";

/**
 * Atomically moves `${path}/${id}` from one of `from` to `to`, then merges `extra` fields.
 *
 * The status check runs inside a Firebase transaction on the record's `status` field, so it is
 * evaluated against the server's current value — not a copy the client loaded earlier. Two tabs
 * approving the same document, or a stale tab cancelling something already shipped, get an error
 * instead of silently overwriting. Returns the status the record was in before the move.
 */
export async function transitionStatus<S extends string>(
  path: string,
  id: string,
  from: readonly S[],
  to: S,
  extra: Record<string, unknown> = {},
): Promise<S> {
  const statusRef = ref(database, `${path}/${id}/status`);
  let previous: S | null = null;
  let rejected = false;

  const result = await runTransaction(statusRef, (current: S | null) => {
    rejected = false;
    previous = current;
    // null may only mean "not cached locally yet" — a no-op write lets the server re-run us with
    // the real value if the record exists.
    if (current === null) return null;
    if (!from.includes(current)) {
      rejected = true;
      return; // abort
    }
    return to;
  });

  if (rejected) {
    throw new Error(
      `Cannot change status from ${formatStatusLabel(String(previous))} to ${formatStatusLabel(to)} — it was changed elsewhere. Refresh and try again.`,
    );
  }
  if (!result.committed || result.snapshot.val() !== to) {
    throw new Error("Record not found. Refresh and try again.");
  }
  await updateRecord(path, id, extra);
  return previous as unknown as S;
}

/**
 * Atomically moves `${path}/${id}` from one of `from` to `to`, then runs the stock side effect
 * the move stands for (ledger posting, reservation release, incoming delta...). The status check
 * happens first, so a stale tab or double click is rejected before anything is posted. If the side
 * effect fails, the status is moved back so the action can simply be retried — side effects
 * should be wrapped in `postOnce` so the retry never repeats what already succeeded.
 * `extra` fields are written only once the side effect succeeded.
 */
export async function transitionWithSideEffect<S extends string>(
  path: string,
  id: string,
  from: readonly S[],
  to: S,
  sideEffect: () => Promise<void>,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const previous = await transitionStatus(path, id, from, to);
  try {
    await sideEffect();
  } catch (err) {
    await transitionStatus(path, id, [to], previous).catch(() => undefined);
    throw err;
  }
  if (Object.keys(extra).length > 0) await updateRecord(path, id, extra);
}
