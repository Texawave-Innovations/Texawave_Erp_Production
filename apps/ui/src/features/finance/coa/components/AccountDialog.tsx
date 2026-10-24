"use client";

import { useMemo, useState } from "react";
import {
  FINANCE_ACCOUNT_TYPES,
  type FinanceAccount,
  type FinanceAccountType,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  createFinanceAccountSchema,
  updateFinanceAccountSchema,
  type CreateFinanceAccountFormValues,
  type UpdateFinanceAccountFormValues,
} from "../schema";

export interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  account?: FinanceAccount | null | undefined;
  parentAccounts?: FinanceAccount[] | undefined;
  defaultParentId?: number | null | undefined;
  defaultType?: FinanceAccountType | undefined;
  onSubmit: (
    values: CreateFinanceAccountFormValues | UpdateFinanceAccountFormValues,
  ) => Promise<void>;
}

interface AccountDialogFormProps {
  account?: FinanceAccount | null | undefined;
  parentAccounts: FinanceAccount[];
  defaultParentId: number | null;
  defaultType: FinanceAccountType;
  onClose: () => void;
  onSubmit: (
    values: CreateFinanceAccountFormValues | UpdateFinanceAccountFormValues,
  ) => Promise<void>;
}

function AccountDialogForm({
  account,
  parentAccounts,
  defaultParentId,
  defaultType,
  onClose,
  onSubmit,
}: AccountDialogFormProps) {
  const isEdit = Boolean(account);

  const [accountCode, setAccountCode] = useState(account?.accountCode ?? "");
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [accountType, setAccountType] = useState<FinanceAccountType>(
    account?.accountType ?? defaultType,
  );
  const [parentAccountId, setParentAccountId] = useState<string>(
    account?.parentAccountId
      ? String(account.parentAccountId)
      : defaultParentId
        ? String(defaultParentId)
        : "none",
  );
  const [currency, setCurrency] = useState(account?.currency || "INR");
  const [description, setDescription] = useState(account?.description ?? "");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Exclude current account from being its own parent in edit mode
  const eligibleParents = useMemo(() => {
    return parentAccounts.filter((a) => {
      if (account && a.id === account.id) return false;
      return true;
    });
  }, [parentAccounts, account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const resolvedParentId =
      parentAccountId && parentAccountId !== "none"
        ? Number(parentAccountId)
        : null;

    if (isEdit) {
      const parsed = updateFinanceAccountSchema.safeParse({
        accountCode,
        accountName,
        parentAccountId: resolvedParentId,
        currency,
        description: description ? description : null,
        isActive,
      });

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string" && !fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setSubmitting(true);
      try {
        await onSubmit(parsed.data);
        onClose();
      } catch (err: unknown) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Failed to update account. Please review details and try again.",
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      const parsed = createFinanceAccountSchema.safeParse({
        accountCode,
        accountName,
        accountType,
        parentAccountId: resolvedParentId,
        currency,
        description: description ? description : null,
      });

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string" && !fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setSubmitting(true);
      try {
        await onSubmit(parsed.data);
        onClose();
      } catch (err: unknown) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Failed to create account. Please ensure code is unique in your organization.",
        );
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {submitError ? (
        <Alert variant="error" title="Error Saving Account">
          {submitError}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 relative focus-within:z-30">
        <FormField
          label="Account Code"
          required
          error={errors.accountCode}
          hint="Unique identifier (e.g. 1010)"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. 1010"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField
          label="Account Name"
          required
          error={errors.accountName}
          hint="Official ledger descriptive name"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. Cash in Hand"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 relative focus-within:z-30">
        <FormField
          label="Classification / Type"
          required
          error={errors.accountType}
          hint={
            isEdit
              ? "Locked after creation to preserve ledger integrity"
              : "Standard balance sheet or income statement group"
          }
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as FinanceAccountType)
              }
              disabled={submitting || isEdit}
            >
              {FINANCE_ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Parent Account"
          hint="Select parent group for hierarchical nesting"
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={parentAccountId}
              onChange={(e) => setParentAccountId(e.target.value)}
              disabled={submitting}
            >
              <option value="none">— Top-Level (Root Account) —</option>
              {eligibleParents.map((parent) => (
                <option key={parent.id} value={String(parent.id)}>
                  {parent.accountCode} — {parent.accountName} (
                  {parent.accountType})
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 relative focus-within:z-30">
        <FormField
          label="Currency"
          error={errors.currency}
          hint="Standard 3-letter currency symbol"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="INR"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={submitting}
              maxLength={3}
            />
          )}
        </FormField>

        {isEdit ? (
          <div className="flex flex-col justify-center pt-5">
            <label className="flex items-center gap-2.5 text-theme-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
              <Checkbox
                checked={isActive}
                onChange={() => setIsActive((prev) => !prev)}
                disabled={submitting}
              />
              <span>Active Account (available for postings)</span>
            </label>
          </div>
        ) : null}
      </div>

      <FormField
        label="Description / Accounting Notes"
        error={errors.description}
        hint="Optional notes on usage or statutory purpose"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            placeholder="Provide accounting guidance or describe the scope of transactions for this account..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={3}
          />
        )}
      </FormField>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {isEdit ? "Save Changes" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}

export function AccountDialog({
  open,
  onClose,
  account,
  parentAccounts = [],
  defaultParentId = null,
  defaultType = "ASSET",
  onSubmit,
}: AccountDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={account ? "Edit Account" : "New Account"}
      size="lg"
    >
      <AccountDialogForm
        key={account ? account.id : `new-${defaultParentId ?? "root"}`}
        account={account}
        parentAccounts={parentAccounts}
        defaultParentId={defaultParentId}
        defaultType={defaultType}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
