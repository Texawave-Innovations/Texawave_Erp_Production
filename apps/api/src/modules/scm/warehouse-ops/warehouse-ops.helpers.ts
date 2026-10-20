export const PUTAWAY_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const MOVEMENT_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const PUTAWAY_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
export const MOVEMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function statusesLeadingTo(
  map: Record<string, string[]>,
  to: string,
): string[] {
  return Object.keys(map).filter((from) => map[from]!.includes(to));
}

/** Legacy `capacityState`. */
export type CapacityState =
  "Unconfigured" | "Available" | "Partially Occupied" | "Full";

export function capacityState(
  capacity: number | null | undefined,
  occupied: number,
): CapacityState {
  if (!capacity || capacity <= 0) return "Unconfigured";
  if (occupied <= 0) return "Available";
  if (occupied >= capacity) return "Full";
  return "Partially Occupied";
}
