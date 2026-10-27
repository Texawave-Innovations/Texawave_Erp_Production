"use client";

import { useMemo, useState } from "react";
import type {
  CreateFinanceBankAccountInput,
  FinanceBankAccountType,
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
import { Building2, Plus } from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useCreateBankAccount } from "../hooks";
import { createBankAccountSchema } from "../schema";

export interface AddBankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

export function AddBankAccountDialog({
  open,
  onClose,
  onSuccess,
}: AddBankAccountDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateBankAccount();

  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] =
    useState<FinanceBankAccountType>("CURRENT");
  const [currency, setCurrency] = useState("INR");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [glAccountId, setGlAccountId] = useState<number | "">("");
  const [isActive, setIsActive] = useState(true);

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

  const resetForm = () => {
    setAccountName("");
    setAccountNumber("");
    setBankName("");
    setIfscCode("");
    setBranchName("");
    setAccountType("CURRENT");
    setCurrency("INR");
    setOpeningBalance("0");
    setGlAccountId("");
    setIsActive(true);
    setSubmitError(null);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const rawOpeningBalance = Number(openingBalance) || 0;

    const parseResult = createBankAccountSchema.safeParse({
      accountName,
      accountNumber,
      bankName,
      ifscCode,
      branchName: branchName || null,
      accountType,
      currency,
      openingBalance: rawOpeningBalance,
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

    const payload: CreateFinanceBankAccountInput = {
      accountName: parseResult.data.accountName,
      accountNumber: parseResult.data.accountNumber,
      bankName: parseResult.data.bankName,
      ifscCode: parseResult.data.ifscCode,
      accountType: parseResult.data.accountType,
      currency: parseResult.data.currency,
      openingBalance: parseResult.data.openingBalance,
      isActive: parseResult.data.isActive,
      ...(parseResult.data.branchName
        ? { branchName: parseResult.data.branchName }
        : {}),
      ...(parseResult.data.glAccountId
        ? { glAccountId: parseResult.data.glAccountId }
        : {}),
    };

    setSubmitting(true);
    try {
      const created = await createMutation.mutateAsync(payload);
      toast({
        title: `Bank account ${created.accountName} registered successfully`,
        variant: "success",
      });
      handleClose();
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to register bank account";
      setSubmitError(msg);
      if (
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("account number")
      ) {
        setErrors((prev) => ({
          ...prev,
          accountNumber: msg,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Register New Bank Account</span>
        </div>
      }
      size="2xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 text-theme-sm relative focus-within:z-30"
      >
        {submitError && (
          <Alert variant="error" title="Registration Failed">
            {submitError}
          </Alert>
        )}

        {/* Row 1: Account Name & Account Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Account Display Name"
            required
            error={errors.accountName}
            hint="e.g. HDFC Primary Operating Account"
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

          <FormField
            label="Account Number"
            required
            error={errors.accountNumber}
            hint="Unique bank account number"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={accountNumber}
                placeholder="e.g. 50200012345678"
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Row 2: Bank Name & IFSC Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Banking Institution Name"
            required
            error={errors.bankName}
            hint="e.g. HDFC Bank, ICICI Bank, State Bank of India"
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
            hint="e.g. HDFC0001234"
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
          <FormField
            label="Branch Name / Location"
            error={errors.branchName}
            hint="Optional branch location"
          >
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

        {/* Row 4: Currency, Opening Balance, Linked Asset GL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Currency" required error={errors.currency}>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </Select>
            )}
          </FormField>

          <FormField
            label="Opening Balance"
            required
            error={errors.openingBalance}
            hint="Initial balance at onboarding"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Linked GL Asset Account"
            error={errors.glAccountId}
            hint="Chart of Accounts link"
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
        </div>

        {/* Row 5: Active Status */}
        <div className="flex items-center gap-2 pt-2">
          <input
            id="is-account-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
          />
          <label
            htmlFor="is-account-active"
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
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[#1769F5] hover:bg-[#0a3271] text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span>
              {submitting ? "Registering..." : "Register Bank Account"}
            </span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
