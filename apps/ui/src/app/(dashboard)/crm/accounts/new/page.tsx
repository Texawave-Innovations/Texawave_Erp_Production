"use client";

import { Button, Card } from "@texawave-erp/ui-kit";
import { useRouter } from "next/navigation";
import { useCreateAccount } from "@/features/crm/accounts/hooks";
import { AccountForm } from "@/features/crm/accounts/components/AccountForm";

export default function CrmNewAccountPage() {
  const router = useRouter();
  const createMutation = useCreateAccount();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/crm/accounts")}
        >
          ← Back to Accounts
        </Button>
      </div>
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        New Account
      </h1>
      <Card>
        <AccountForm
          onSubmit={async (values) => {
            const account = await createMutation.mutateAsync(values);
            router.push(`/crm/accounts/${account.id}`);
          }}
          onCancel={() => router.push("/crm/accounts")}
          submitLabel="Create account"
        />
      </Card>
    </div>
  );
}
