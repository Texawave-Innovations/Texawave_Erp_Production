"use client";

import { StatusBadge } from "@texawave-erp/ui-kit";

/**
 * The column only ever holds "PENDING_ACTIVATION" or "COMPLETE"
 * (Docs/ARCHITECTURE.md §7 — apps/api/.../profile.service.ts). Mirrors the
 * mapping already used by EmployeeOnboardingProgress (the dedicated
 * onboarding page), kept consistent here for the directory list.
 */
export function OnboardingStatusBadge({ status }: { status: string }) {
  const complete = status === "COMPLETE";
  return (
    <StatusBadge
      label={complete ? "Complete" : "In progress"}
      colorToken={complete ? "success" : "warning"}
    />
  );
}
