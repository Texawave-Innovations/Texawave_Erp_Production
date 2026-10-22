"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/legacy-ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { AccountFormDialog } from "./AccountFormDialog";

/** Full-page "Add Account" (stacked boxes) for the /crm/accounts/new route. */
export function AccountCreatePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user?.fullName);

  return (
    <div className="space-y-6 pb-8">
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl gap-1.5 -ml-2"
        onClick={() => router.push("/crm/accounts")}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Accounts
      </Button>
      <AccountFormDialog
        open
        onOpenChange={() => undefined}
        mode="create"
        currentUser={currentUser}
        renderAs="page"
        onCancel={() => router.push("/crm/accounts")}
        onSaved={(id) => router.push(`/crm/accounts/${id}`)}
      />
    </div>
  );
}
