// Shown only when the page was opened via a CRM Dashboard button/card (navigate(..., { state:
// { fromCrmDashboard: true } })). On any other entry point (top nav, direct link, deep link) it
// renders nothing, leaving that page's existing back/navigation behavior untouched.
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToDashboardButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const fromDashboard = (
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  if (!fromDashboard) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-xl gap-1.5 border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 hover:border-brand-300 shrink-0"
      onClick={() => navigate("/crm/dashboard")}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
    </Button>
  );
}

export default BackToDashboardButton;
