import { database, ref, runTransaction } from "@/services/firebase";
import { firebaseKey } from "@/modules/scm/inventory/inventoryPaths";
import type { Vendor, VendorStatus } from "@/types";

/** Records created before Phase 2 have no `status` field — treat that as Active rather than
 * showing a blank/unknown state, the same convention `trusted` already uses (defaults falsy). */
export function getSupplierStatus(vendor: Vendor): VendorStatus {
  return vendor.status || "Active";
}

export const SUPPLIER_STATUSES: VendorStatus[] = [
  "Active",
  "Inactive",
  "Pending Approval",
  "Blocked",
];

export function statusBadgeTone(status: VendorStatus): string {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Inactive":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "Pending Approval":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Blocked":
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
}

export function matchesSupplierSearch(vendor: Vendor, search: string): boolean {
  const s = search.trim().toLowerCase();
  if (!s) return true;
  return [
    vendor.vendorCode,
    vendor.companyName,
    vendor.contactPerson,
    vendor.email,
    vendor.phone,
    vendor.gst,
  ].some((field) => field?.toLowerCase().includes(s));
}

/** Atomically claims a supplier code so two near-concurrent supplier creations (or edits that
 * change the code) can never end up with the same `vendorCode` — the failure mode QA found live
 * (two suppliers both "VEND-0003"). A plain "fetch existing codes, check, then write" (the
 * previous approach) has a race window between the check and the write; this closes it with a
 * Firebase transaction on a per-code claim node, which only one caller can ever win. Claims are
 * permanent — nothing releases them — matching how a real vendor code is never reused. */
export async function claimSupplierCode(code: string): Promise<boolean> {
  const key = firebaseKey(code.trim().toUpperCase());
  if (!key) return false;
  const claimRef = ref(database, `meta/supplierCodeClaims/${key}`);
  const result = await runTransaction(claimRef, (current: number | null) =>
    current === null ? Date.now() : undefined,
  );
  return result.committed;
}

const SUPPLIER_CODE_PREFIX = "VEND-";

/** Next free-looking supplier code: one past the highest numeric suffix in use (not count+1, which
 * repeats a code as soon as any supplier is deleted). Uniqueness is still enforced by
 * `claimSupplierCode` at save time. */
export function nextSupplierCode(
  vendors: Pick<Vendor, "vendorCode">[],
): string {
  const max = vendors.reduce((m, v) => {
    const match = /(\d+)$/.exec(v.vendorCode || "");
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${SUPPLIER_CODE_PREFIX}${String(max + 1).padStart(4, "0")}`;
}

/** Claims `preferred`, or — when it's taken (e.g. by a concurrent creation) — the next codes after
 * it. For forms where the code is auto-generated and not user-editable. */
export async function claimAvailableSupplierCode(
  preferred: string,
  attempts = 10,
): Promise<string> {
  let code = preferred;
  for (let i = 0; i < attempts; i++) {
    if (await claimSupplierCode(code)) return code;
    code = nextSupplierCode([{ vendorCode: code }]);
  }
  throw new Error(
    "Could not allocate a unique supplier code. Please try again.",
  );
}
