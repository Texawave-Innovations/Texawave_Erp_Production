// CRM Core Domain — generic Firebase Realtime Database collection helpers.
// Thin wrapper around the same primitives every other CRM data path already uses
// (`onValue`/`push`/`set`/`update`/`remove` from `src/services/firebase.ts` / `firebase/database`),
// so every domain service file (accountsService.ts, contactsService.ts, ...) shares one
// subscribe/create/update/remove implementation instead of re-deriving it per collection.
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { database } from "@/services/firebase";

/** Firebase RTDB rejects `undefined` values (e.g. a blank optional number field left as
 *  `undefined` in form state) — drop those keys before every write so callers can freely
 *  leave optional fields unset instead of having to prune them by hand. */
export function stripUndefined<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  const clean: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) clean[key as keyof T] = value as T[keyof T];
  }
  return clean;
}

export function subscribeCollection<T extends { id: string }>(
  path: string,
  callback: (items: T[]) => void,
): () => void {
  const collectionRef = ref(database, path);
  const unsubscribe = onValue(collectionRef, (snap) => {
    const val = (snap.val() || {}) as Record<string, Omit<T, "id">>;
    callback(
      Object.entries(val).map(
        ([id, item]) => ({ id, ...(item as object) }) as T,
      ),
    );
  });
  return unsubscribe;
}

export async function createInCollection<T extends { id: string }>(
  path: string,
  data: Omit<T, "id">,
): Promise<string> {
  const newRef = push(ref(database, path));
  if (!newRef.key) throw new Error(`Failed to allocate id under ${path}`);
  await set(newRef, stripUndefined(data as Record<string, unknown>));
  return newRef.key;
}

export async function updateInCollection(
  path: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await update(ref(database, `${path}/${id}`), stripUndefined(data));
}

export async function removeFromCollection(
  path: string,
  id: string,
): Promise<void> {
  await remove(ref(database, `${path}/${id}`));
}
