"use client";

import type { BankAccount } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useUpdateBankAccount,
} from "../hooks";
import { BANK_ACCOUNT_READ, BANK_ACCOUNT_WRITE } from "../permissions";
import type { BankAccountFormValues } from "../schema";
import { BankAccountForm } from "./BankAccountForm";

const PAGE_SIZE = 10;

export function BankAccountsPanel() {
  const canRead = usePermission(BANK_ACCOUNT_READ);
  const canWrite = usePermission(BANK_ACCOUNT_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);
  const { toast } = useToast();

  const query = useBankAccounts({ page, limit: PAGE_SIZE });
  const createMutation = useCreateBankAccount();
  const updateMutation = useUpdateBankAccount();
  const deleteMutation = useDeleteBankAccount();

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to bank accounts">
        Ask an administrator for the <code>{BANK_ACCOUNT_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const accounts = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: BankAccountFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Bank account added", variant: "success" });
  }

  async function handleUpdate(values: BankAccountFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    toast({ title: "Bank account updated", variant: "success" });
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast({ title: `Deleted "${deleting.bankName}"`, variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError && error.isPermissionError
            ? `You don't have the ${BANK_ACCOUNT_WRITE} permission.`
            : `Could not delete "${deleting.bankName}"`,
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 p-1">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Bank accounts
          </h3>
          {canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add bank account
            </Button>
          ) : null}
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            title="No bank accounts yet"
            description="Add a bank account to show it on printed sales documents."
          />
        ) : (
          <>
            <DataTable<BankAccount>
              caption="Bank accounts"
              columns={[
                { header: "Bank", cell: (a) => a.bankName },
                { header: "Account holder", cell: (a) => a.accountHolderName },
                { header: "Account number", cell: (a) => a.accountNumber },
                { header: "IFSC", cell: (a) => a.ifscCode },
                { header: "Primary", cell: (a) => (a.isPrimary ? "Yes" : "") },
                ...(canWrite
                  ? [
                      {
                        header: "Actions",
                        headerClassName: "sr-only",
                        className: "text-right",
                        cell: (a: BankAccount) => (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(a)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleting(a)}
                            >
                              Delete
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={accounts}
              getRowKey={(a) => String(a.id)}
            />
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add bank account"
      >
        <BankAccountForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Add bank account"
        />
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit bank account"
      >
        {editing ? (
          <BankAccountForm
            initialValues={{
              bankName: editing.bankName,
              accountHolderName: editing.accountHolderName,
              accountNumber: editing.accountNumber,
              ifscCode: editing.ifscCode,
              branchName: editing.branchName ?? "",
              isPrimary: editing.isPrimary,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete bank account"
        itemName={deleting?.bankName ?? ""}
        loading={deleteMutation.isPending}
      />
    </Card>
  );
}
