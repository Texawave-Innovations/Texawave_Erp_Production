"use client";

import { useMemo, useState } from "react";
import type {
  FinanceBankAccount,
  FinanceBankAccountType,
  UpdateFinanceBankAccountInput,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { Pencil } from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useUpdateBankAccount } from "../hooks";
import { updateBankAccountSchema } from "../schema";

export interface EditBankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  account: FinanceBankAccount | null;
  onSuccess?: (() => void) | undefined;
}

interface EditBankAccountFormProps {
  account: FinanceBankAccount;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

function EditBankAccountForm({
  account,
  onClose,
  onSuccess,
}: EditBankAccountFormProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateBankAccount();

  const [accountName, setAccountName] = useState(account.accountName ?? "");
  const [bankName, setBankName] = useState(account.bankName ?? "");
  const [ifscCode, setIfscCode] = useState(account.ifscCode ?? "");
  const [branchName, setBranchName] = useState(account.branchName ?? "");
  const [accountType, setAccountType] = useState<FinanceBankAccountType>(
    account.accountType ?? "CURRENT",
  );
  const [glAccountId, setGlAccountId] = useState<number | "">(
    account.glAccountId ?? "",
  );
  const [isActive, setIsActive] = useState(Boolean(account.isActive));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Query Asset Chart of Accounts for linking
  const accountsQuery = useAccounts({
    accountType: "ASSET",
    isActive: true,
    limit: 100,
  });

  const assetAccounts = useMemo(() => {
    return accountsQuery.data?.data ?? [];
  }, [accountsQuery.data?.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const parseResult = updateBankAccountSchema.safeParse({
      accountName,
      bankName,
      ifscCode,
      branchName: branchName || null,
      accountType,
      glAccountId: glAccountId ? Number(glAccountId) : null,
      isActive,
    });

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    const payload: UpdateFinanceBankAccountInput = {
      ...(parseResult.data.accountName
        ? { accountName: parseResult.data.accountName }
        : {}),
      ...(parseResult.data.bankName
        ? { bankName: parseResult.data.bankName }
        : {}),
      ...(parseResult.data.ifscCode
        ? { ifscCode: parseResult.data.ifscCode }
        : {}),
      ...(parseResult.data.branchName
        ? { branchName: parseResult.data.branchName }
        : {}),
      ...(parseResult.data.accountType
        ? { accountType: parseResult.data.accountType }
        : {}),
      ...(parseResult.data.glAccountId !== undefined
        ? { glAccountId: parseResult.data.glAccountId }
        : {}),
      ...(parseResult.data.isActive !== undefined
        ? { isActive: parseResult.data.isActive }
        : {}),
    };

    setSubmitting(true);
    try {
      const updated = await updateMutation.mutateAsync({
        id: account.id,
        input: payload,
      });
      toast({
        title: `Bank account ${updated.accountName} updated successfully`,
        variant: "success",
      });
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update bank account";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 text-theme-sm relative focus-within:z-30"
    >
      {submitError && (
        <Alert variant="error" title="Update Failed">
          {submitError}
        </Alert>
      )}

      {/* Read-only account info banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-theme-xs text-blue-900 dark:border-blue-950/70 dark:bg-blue-950/30 dark:text-blue-200">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-semibold">Account Number: </span>
            <span>{account.accountNumber}</span>
          </div>
          <div>
            <span className="font-semibold">Current Balance: </span>
            <span>
              {account.currency} {account.currentBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Account Display Name */}
      <FormField
        label="Account Display Name"
        required
        error={errors.accountName}
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={accountName}
            placeholder="e.g. HDFC Operating"
            onChange={(e) => setAccountName(e.target.value)}
          />
        )}
      </FormField>

      {/* Row 2: Bank Name & IFSC Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Banking Institution Name"
          required
          error={errors.bankName}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={bankName}
              placeholder="e.g. HDFC Bank Ltd"
              onChange={(e) => setBankName(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="IFSC / Branch Routing Code"
          required
          error={errors.ifscCode}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={ifscCode}
              placeholder="e.g. HDFC0001234"
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            />
          )}
        </FormField>
      </div>

      {/* Row 3: Branch Name & Account Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Branch Name / Location" error={errors.branchName}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={branchName}
              placeholder="e.g. Indiranagar, Bengaluru"
              onChange={(e) => setBranchName(e.target.value)}
            />
          )}
        </FormField>

        <FormField label="Account Type" required error={errors.accountType}>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as FinanceBankAccountType)
              }
            >
              <option value="CURRENT">Current Account</option>
              <option value="SAVINGS">Savings Account</option>
              <option value="OVERDRAFT">Overdraft (OD / CC)</option>
            </Select>
          )}
        </FormField>
      </div>

      {/* Row 4: Linked Asset GL Account */}
      <FormField
        label="Linked GL Asset Account"
        error={errors.glAccountId}
        hint="Chart of Accounts link for automatic journal double-entries"
      >
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={glAccountId}
            onChange={(e) =>
              setGlAccountId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">No GL Account Linked</option>
            {assetAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountCode} — {acc.accountName}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {/* Row 5: Active Status */}
      <div className="flex items-center gap-2 pt-2">
        <input
          id="edit-is-account-active"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
        />
        <label
          htmlFor="edit-is-account-active"
          className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          Active (ready for deposits, disbursements, and reconciliations)
        </label>
      </div>

      {/* Dialog Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-[#1769F5] hover:bg-[#0a3271] text-white"
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          <span>{submitting ? "Saving..." : "Save Changes"}</span>
        </Button>
      </div>
    </form>
  );
}

export function EditBankAccountDialog({
  open,
  onClose,
  account,
  onSuccess,
}: EditBankAccountDialogProps) {
  if (!account) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Edit Bank Account: {account.accountName}</span>
        </div>
      }
      size="2xl"
    >
      <EditBankAccountForm
        key={account.id}
        account={account}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
