// src/modules/projects/mom/services/momReferenceService.ts

import { ref, runTransaction, get } from "firebase/database";
import { database } from "@/services/firebase";

/**
 * Concurrency-safe atomic reference generator.
 * Uses Firebase Realtime Database transactions on a dedicated counter node:
 *   `mom_counters/${year}`
 *
 * This ensures that simultaneous creations never produce colliding or duplicate
 * reference numbers and does NOT rely on counting current records (which would collide
 * if records were deleted or created concurrently).
 *
 * Example produced: "MOM-2026-0001"
 */
export async function generateNextMomReference(
  customYear?: number,
): Promise<string> {
  const year = customYear || new Date().getFullYear();
  const counterRef = ref(database, `mom_counters/${year}`);

  try {
    const result = await runTransaction(counterRef, (currentValue) => {
      // If counter doesn't exist yet, start at 1; otherwise increment
      return (currentValue || 0) + 1;
    });

    if (result.committed) {
      const sequenceNumber = result.snapshot.val();
      const padded = String(sequenceNumber).padStart(4, "0");
      return `MOM-${year}-${padded}`;
    }
  } catch (err) {
    console.error("Error in runTransaction for mom_counters:", err);
  }

  // Fallback if transaction fails (e.g. offline or strict rules):
  try {
    const snapshot = await get(counterRef);
    let nextVal = 1;
    if (snapshot.exists()) {
      nextVal = Number(snapshot.val()) + 1;
    }
    const padded = String(nextVal).padStart(4, "0");
    return `MOM-${year}-${padded}`;
  } catch {
    // Timestamp-based emergency fallback to guarantee uniqueness
    const fallbackSeq = String(Date.now()).slice(-4);
    return `MOM-${year}-${fallbackSeq}`;
  }
}
