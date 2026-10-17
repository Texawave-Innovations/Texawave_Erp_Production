"use client";

// Shown only when the page was opened via a CRM Dashboard button/card. Legacy carried that in
// react-router `location.state.fromCrmDashboard`; Next has no navigation state, so the dashboard
// links add `?from=dashboard` (use `withDashboardOrigin(href)` below). On any other entry point
// (top nav, direct link, deep link) this renders nothing.
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/legacy-ui/button";

export const DASHBOARD_ORIGIN_PARAM = "from";
export const DASHBOARD_ORIGIN_VALUE = "dashboard";

/** Append the "opened from the CRM dashboard" marker to an href, e.g. `withDashboardOrigin("/crm/leads")`. */
export function withDashboardOrigin(href: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${DASHBOARD_ORIGIN_PARAM}=${DASHBOARD_ORIGIN_VALUE}`;
}

function BackToDashboardButtonInner() {
  const router = useRouter();
  const params = useSearchParams();
  if (params.get(DASHBOARD_ORIGIN_PARAM) !== DASHBOARD_ORIGIN_VALUE)
    return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-xl gap-1.5 border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 hover:border-brand-300 shrink-0"
      onClick={() => router.push("/crm/dashboard")}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
    </Button>
  );
}

export function BackToDashboardButton() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <BackToDashboardButtonInner />
    </Suspense>
  );
}

export default BackToDashboardButton;
