import {
  database,
  ref,
  set,
  get,
  runTransaction,
  getAllRecords,
  stripUndefined,
} from "@/services/firebase";
import { push, remove } from "firebase/database";
import {
  INVENTORY_PATHS,
  balanceKey,
  batchKey,
  firebaseKey,
} from "./inventoryPaths";
import type {
  StockBalance,
  StockLedgerEntry,
  StockLedgerTransactionType,
  StockBatch,
} from "@/types";

export interface PostLedgerEntryParams {
  productCode: string;
  productName: string;
  warehouseId: string;
  locationId?: string;
  batchId?: string;
  serialId?: string;
  transactionType: StockLedgerTransactionType;
  referenceType: string;
  referenceId?: string;
  referenceNumber?: string;
  quantityIn?: number;
  quantityOut?: number;
  unitCost?: number;
  notes?: string;
  createdBy: string;
  /** Skip the non-negative stock guard. Only for deliberate corrections (e.g. an approved
   * adjustment that reconciles a known negative drift) — never for normal movements. */
  allowNegative?: boolean;
}

/** Ledger transaction types that add to on-hand. */
const IN_TYPES = new Set<StockLedgerTransactionType>([
  "OPENING_BALANCE",
  "PURCHASE_RECEIPT",
  "SALES_RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "QC_RELEASE",
]);
/** Ledger transaction types that subtract from on-hand. QC_REJECT is validation-only here (it
 * must carry a quantityOut) — its actual on-hand effect is special-cased to zero below, since
 * the quantity it moves was already removed from on-hand by an earlier QUARANTINE posting. */
const OUT_TYPES = new Set<StockLedgerTransactionType>([
  "SALES_ISSUE",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "QUARANTINE",
  "QC_REJECT",
]);

function emptyBalance(
  key: string,
  productCode: string,
  productName: string,
  warehouseId: string,
): StockBalance {
  return {
    id: key,
    productCode,
    productName,
    warehouseId,
    onHand: 0,
    reserved: 0,
    available: 0,
    incoming: 0,
    damaged: 0,
    quarantine: 0,
    updatedAt: Date.now(),
  };
}

interface BalanceDelta {
  onHand: number;
  damaged: number;
  quarantine: number;
}

function balanceDeltaFor(
  type: StockLedgerTransactionType,
  quantityIn: number,
  quantityOut: number,
): BalanceDelta {
  // QC_REJECT never touches on-hand a second time — the quantity it writes off was already
  // removed from on-hand by the QUARANTINE posting that put it on hold in the first place.
  return {
    onHand: type === "QC_REJECT" ? 0 : quantityIn - quantityOut,
    damaged: type === "DAMAGE" || type === "QC_REJECT" ? quantityOut : 0,
    quarantine:
      type === "QUARANTINE"
        ? quantityOut
        : type === "QC_RELEASE"
          ? -quantityIn
          : type === "QC_REJECT"
            ? -quantityOut
            : 0,
  };
}

/** Returns an error message when applying `delta` would drive the balance below what physically
 * exists, or null when it's allowed. SALES_ISSUE consumes stock that was reserved for it, so it is
 * checked against on-hand; every other outbound movement may only take unreserved stock. */
function stockGuardError(
  type: StockLedgerTransactionType,
  base: StockBalance,
  delta: BalanceDelta,
  quantity: number,
): string | null {
  if (type === "QC_RELEASE" || type === "QC_REJECT") {
    return (base.quarantine || 0) < quantity
      ? `Only ${base.quarantine || 0} unit(s) are in quarantine for ${base.productCode}.`
      : null;
  }
  if (delta.onHand >= 0) return null;
  const takeable =
    type === "SALES_ISSUE" ? base.onHand : base.onHand - (base.reserved || 0);
  return takeable < quantity
    ? `Insufficient stock for ${base.productCode}: ${Math.max(0, takeable)} available, ${quantity} required.`
    : null;
}

async function applyBalanceDelta(
  params: PostLedgerEntryParams,
  delta: BalanceDelta,
  quantity: number,
  guard: boolean,
): Promise<void> {
  const key = balanceKey(params.productCode, params.warehouseId);
  const balRef = ref(database, `${INVENTORY_PATHS.balances}/${key}`);
  const needsExisting =
    guard &&
    (delta.onHand < 0 ||
      params.transactionType === "QC_RELEASE" ||
      params.transactionType === "QC_REJECT");
  let guardError: string | null = null;

  const result = await runTransaction(
    balRef,
    (current: StockBalance | null) => {
      guardError = null;
      // The first run may see `null` simply because nothing is cached locally yet. Returning null
      // (a no-op write) makes the server compare against the real value and re-run us with it if
      // the row exists; if it genuinely doesn't exist, the commit leaves a null snapshot below.
      if (current === null && needsExisting) return null;
      const base =
        current ||
        emptyBalance(
          key,
          params.productCode,
          params.productName,
          params.warehouseId,
        );
      if (guard) {
        guardError = stockGuardError(
          params.transactionType,
          base,
          delta,
          quantity,
        );
        if (guardError) return; // abort
      }
      const onHand = base.onHand + delta.onHand;
      const reserved = base.reserved || 0;
      return {
        ...base,
        productName: params.productName || base.productName,
        onHand,
        reserved,
        available: onHand - reserved,
        damaged: Math.max(0, (base.damaged || 0) + delta.damaged),
        quarantine: Math.max(0, (base.quarantine || 0) + delta.quarantine),
        updatedAt: Date.now(),
      };
    },
  );

  if (guardError) throw new Error(guardError);
  if (!result.committed)
    throw new Error(
      `Failed to update stock balance for ${params.productCode}.`,
    );
  if (needsExisting && result.snapshot.val() === null) {
    throw new Error(
      `No stock exists for ${params.productCode} in this warehouse.`,
    );
  }
}

/**
 * The single write path for every stock movement. Folds the movement into the derived
 * stock-balance row inside a Firebase transaction — which is also where the non-negative stock
 * guard lives, so two concurrent issues can never both pass a stale availability check — and only
 * then appends the immutable ledger entry. If the ledger write fails, the balance change is
 * reversed so the two never drift apart. The ledger entry itself is never edited or deleted after
 * this — corrections are new, offsetting entries.
 */
export async function postLedgerEntry(
  params: PostLedgerEntryParams,
): Promise<string> {
  const quantityIn = Math.max(0, params.quantityIn || 0);
  const quantityOut = Math.max(0, params.quantityOut || 0);

  if (quantityIn === 0 && quantityOut === 0) {
    throw new Error(
      "Ledger entry must have a non-zero quantityIn or quantityOut.",
    );
  }
  if (IN_TYPES.has(params.transactionType) && quantityOut > 0) {
    throw new Error(`${params.transactionType} may not carry a quantityOut.`);
  }
  if (OUT_TYPES.has(params.transactionType) && quantityIn > 0) {
    throw new Error(`${params.transactionType} may not carry a quantityIn.`);
  }

  const delta = balanceDeltaFor(
    params.transactionType,
    quantityIn,
    quantityOut,
  );
  await applyBalanceDelta(
    params,
    delta,
    quantityIn || quantityOut,
    !params.allowNegative,
  );

  const newRef = push(ref(database, INVENTORY_PATHS.ledger));
  const now = Date.now();
  const entry: Omit<StockLedgerEntry, "id"> = {
    productCode: params.productCode,
    productName: params.productName,
    warehouseId: params.warehouseId,
    locationId: params.locationId,
    batchId: params.batchId,
    serialId: params.serialId,
    transactionType: params.transactionType,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    referenceNumber: params.referenceNumber,
    quantityIn,
    quantityOut,
    unitCost: params.unitCost,
    transactionDate: now,
    createdBy: params.createdBy,
    createdAt: now,
    notes: params.notes,
  };

  try {
    await set(newRef, stripUndefined(entry));
  } catch (err) {
    const reverse: BalanceDelta = {
      onHand: -delta.onHand,
      damaged: -delta.damaged,
      quarantine: -delta.quarantine,
    };
    await applyBalanceDelta(params, reverse, 0, false).catch(() => undefined);
    throw err;
  }

  return newRef.key as string;
}

/** Reserve (positive delta) or release (negative delta) stock without posting a ledger
 * transaction — reservations only shrink `available`, they never touch `onHand`. Rejects
 * over-reservation; a release larger than what's reserved clamps at zero. */
export async function applyReservationDelta(
  productCode: string,
  warehouseId: string,
  delta: number,
): Promise<StockBalance> {
  const key = balanceKey(productCode, warehouseId);
  const balRef = ref(database, `${INVENTORY_PATHS.balances}/${key}`);
  let overReserved = false;

  const result = await runTransaction(
    balRef,
    (current: StockBalance | null) => {
      overReserved = false;
      if (current === null) return null; // see applyBalanceDelta — let the server supply the real row
      const nextReserved = Math.max(0, (current.reserved || 0) + delta);
      if (delta > 0 && nextReserved > current.onHand) {
        overReserved = true;
        return; // abort
      }
      return {
        ...current,
        reserved: nextReserved,
        available: current.onHand - nextReserved,
        updatedAt: Date.now(),
      };
    },
  );

  if (overReserved || (delta > 0 && result.snapshot.val() === null)) {
    throw new Error("Cannot reserve more than the available stock.");
  }
  if (!result.committed)
    throw new Error(`Failed to update reservation for ${productCode}.`);
  return result.snapshot.val() as StockBalance;
}

/** Adjusts `incoming` directly — never touches `onHand` or posts a ledger entry. Raised when a
 * PO is approved (by the ordered quantity) and lowered as GRNs receive against that PO, mirroring
 * how `applyReservationDelta` shrinks `available` without touching `onHand`. */
export async function applyIncomingDelta(
  productCode: string,
  warehouseId: string,
  productName: string,
  delta: number,
): Promise<StockBalance | null> {
  const key = balanceKey(productCode, warehouseId);
  const balRef = ref(database, `${INVENTORY_PATHS.balances}/${key}`);

  const result = await runTransaction(
    balRef,
    (current: StockBalance | null) => {
      if (current === null && delta <= 0) return null; // nothing to lower (or not cached yet)
      const base =
        current || emptyBalance(key, productCode, productName, warehouseId);
      const nextIncoming = Math.max(0, (base.incoming || 0) + delta);
      return {
        ...base,
        productName: base.productName || productName,
        incoming: nextIncoming,
        updatedAt: Date.now(),
      };
    },
  );

  return result.snapshot.val() as StockBalance | null;
}

/** Atomically adds `quantity` onto the batch identified by (batchNumber, productCode, warehouseId),
 * creating it if this is the first time that physical lot has been seen. Keyed deterministically
 * (`batchKey`) instead of a random push id, so two receipts of the same vendor batch — whether from
 * concurrent GRNs or a GRN and a manual batch entry — accumulate onto one record instead of each
 * creating its own row for the same lot. Never mutates any *other* batch's fields. */
export async function upsertBatchQuantity(params: {
  batchNumber: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  quantity: number;
  manufacturingDate?: string;
  expiryDate?: string;
  createdBy: string;
}): Promise<StockBatch> {
  const key = batchKey(
    params.batchNumber,
    params.productCode,
    params.warehouseId,
  );
  const batchRef = ref(database, `${INVENTORY_PATHS.batches}/${key}`);

  const result = await runTransaction(
    batchRef,
    (current: StockBatch | null) => {
      const base: StockBatch =
        current ||
        stripUndefined({
          id: key,
          batchNumber: params.batchNumber,
          productCode: params.productCode,
          productName: params.productName,
          warehouseId: params.warehouseId,
          manufacturingDate: params.manufacturingDate,
          expiryDate: params.expiryDate,
          quantity: 0,
          status: "ACTIVE",
          createdBy: params.createdBy,
          createdAt: Date.now(),
        } as StockBatch);
      return { ...base, quantity: (base.quantity || 0) + params.quantity };
    },
  );

  return result.snapshot.val() as StockBatch;
}

/** Posting claims older than this while still PENDING are treated as abandoned (the tab that took
 * them crashed mid-post) and may be taken over. */
const STALE_CLAIM_MS = 2 * 60 * 1000;

interface PostingClaim {
  status: "PENDING" | "POSTED";
  at: number;
  result?: string;
}

/**
 * Runs `post` at most once per (referenceType, referenceId) — e.g. a GRN line, a return line, a
 * QC action, a fulfillment line — and remembers its result (typically a ledger entry id).
 *
 * - First caller: takes a PENDING claim, runs `post`, and records POSTED + the result.
 * - Later callers (duplicate submit, retry, second tab): get the recorded result back with
 *   `alreadyPosted: true` and must not post again.
 * - If `post` throws, the claim is released so a retry can post — a failed posting never
 *   permanently blocks the reference.
 * - A caller arriving while another is mid-post gets an error instead of silently skipping.
 */
export async function postOnce(
  referenceType: string,
  referenceId: string,
  post: () => Promise<string>,
): Promise<{ result: string | undefined; alreadyPosted: boolean }> {
  const claimRef = ref(
    database,
    `${INVENTORY_PATHS.postingClaims}/${firebaseKey(`${referenceType}__${referenceId}`)}`,
  );
  let existing: PostingClaim | null = null;

  const claim = await runTransaction(
    claimRef,
    (current: PostingClaim | number | null) => {
      existing = null;
      if (current === null)
        return { status: "PENDING", at: Date.now() } satisfies PostingClaim;
      // Legacy claims were a bare timestamp written after a successful claim — treat as posted.
      const normalized: PostingClaim =
        typeof current === "number"
          ? { status: "POSTED", at: current }
          : current;
      if (
        normalized.status === "PENDING" &&
        Date.now() - normalized.at > STALE_CLAIM_MS
      ) {
        return { status: "PENDING", at: Date.now() } satisfies PostingClaim;
      }
      existing = normalized;
      return; // abort — someone else holds or completed it
    },
  );

  if (!claim.committed) {
    const held = existing as PostingClaim | null;
    if (held?.status === "POSTED")
      return { result: held.result, alreadyPosted: true };
    throw new Error(
      "This posting is already in progress in another window. Refresh in a moment.",
    );
  }

  try {
    const result = await post();
    await set(
      claimRef,
      stripUndefined({
        status: "POSTED",
        at: Date.now(),
        result,
      } satisfies PostingClaim),
    );
    return { result, alreadyPosted: false };
  } catch (err) {
    await remove(claimRef).catch(() => undefined);
    throw err;
  }
}

export async function getStockBalances(): Promise<StockBalance[]> {
  return (await getAllRecords(INVENTORY_PATHS.balances)) as StockBalance[];
}

export async function getStockBalance(
  productCode: string,
  warehouseId: string,
): Promise<StockBalance | null> {
  const key = balanceKey(productCode, warehouseId);
  const snap = await get(ref(database, `${INVENTORY_PATHS.balances}/${key}`));
  return snap.exists() ? (snap.val() as StockBalance) : null;
}

export async function getLedgerEntries(): Promise<StockLedgerEntry[]> {
  const entries = (await getAllRecords(
    INVENTORY_PATHS.ledger,
  )) as StockLedgerEntry[];
  return entries.sort((a, b) => b.transactionDate - a.transactionDate);
}
