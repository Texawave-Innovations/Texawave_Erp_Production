// CRM Core Domain — Success Celebration bus. A tiny module-level pub/sub, mirroring how `sonner`'s
// `toast()` works: any CRM component calls `celebrateCrm(key)` directly (no Context/Provider
// needed at the call site), and the single `<CrmCelebrationHost />` mounted once in `CRMLayout`
// renders the result. Keeping this decoupled from React state means call sites stay one line and
// never need to know whether the host happens to be mounted.
import {
  CRM_CELEBRATIONS,
  CrmCelebrationKey,
  CelebrationDef,
} from "./celebrationConfig";

export interface CrmCelebrationEvent extends Omit<CelebrationDef, "titles"> {
  id: number;
  key: CrmCelebrationKey;
  title: string;
  /** A bold highlighted value shown above `description`, e.g. "₹1,20,000" for a Won deal. */
  amount?: string;
}

export interface CelebrateOptions {
  /** Overrides the config's static `description` line entirely. */
  detail?: string;
  /** A bold highlighted value rendered above the description, e.g. "₹1,20,000". */
  amount?: string;
}

type Listener = (event: CrmCelebrationEvent) => void;

const listeners = new Set<Listener>();
const lastTitleByKey = new Map<CrmCelebrationKey, string>();
let nextId = 1;

function pickTitle(key: CrmCelebrationKey): string {
  const pool = CRM_CELEBRATIONS[key].titles;
  if (pool.length === 1) return pool[0];
  const last = lastTitleByKey.get(key);
  const candidates = pool.filter((m) => m !== last);
  const chosen =
    candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
  lastTitleByKey.set(key, chosen);
  return chosen;
}

/** Fire a CRM success celebration. Call this only after the write it celebrates has been confirmed. */
export function celebrateCrm(
  key: CrmCelebrationKey,
  options?: CelebrateOptions,
): void {
  // `CRM_CELEBRATIONS` is declared `as const` (so `CrmCelebrationKey` can be derived via `keyof`),
  // which narrows each entry to only its actually-present optional keys — annotating `def` here
  // widens it back to the full `CelebrationDef` shape so `description`/`button` type-check below.
  const def: CelebrationDef | undefined = CRM_CELEBRATIONS[key];
  if (!def) return;
  const event: CrmCelebrationEvent = {
    id: nextId++,
    key,
    variant: def.variant,
    tone: def.tone,
    icon: def.icon,
    title: pickTitle(key),
    subtitle: def.subtitle,
    description: options?.detail ?? def.description,
    amount: options?.amount,
    button: def.button,
    durationMs: def.durationMs,
  };
  // One subscriber throwing must not stop the rest from hearing this event, or skip the caller's
  // own write-confirmation code path that fired `celebrateCrm` in the first place.
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (err) {
      console.error("CRM celebration listener threw:", err);
    }
  });
}

export function subscribeCrmCelebrations(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
