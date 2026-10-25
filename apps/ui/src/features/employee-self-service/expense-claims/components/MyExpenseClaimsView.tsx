"use client";

import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  IndianRupee,
  Plus,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useCreateMyExpenseClaim, useMyExpenseClaims } from "../hooks";
import { EXPENSE_TYPES, type MyExpenseClaim } from "../api";

type ExpenseType = (typeof EXPENSE_TYPES)[number];
type Status = "PENDING" | "APPROVED" | "REJECTED";

// Legacy MyExpenses.tsx statusConfig / categoryColors.
const STATUS_CONFIG: Record<
  Status,
  { label: string; cls: string; icon: LucideIcon }
> = {
  PENDING: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: CircleCheck,
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: CircleX,
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Travel:
    "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-300",
  Food: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-900/60 dark:text-orange-300",
  Accommodation:
    "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-900/60 dark:text-purple-300",
  "Office Supplies":
    "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-900/60 dark:text-teal-300",
  Medical:
    "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300",
  Other:
    "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300",
};

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function rupees(n: number): string {
  return n.toLocaleString("en-IN");
}

function statusOf(claim: MyExpenseClaim): Status {
  return (claim.status in STATUS_CONFIG ? claim.status : "PENDING") as Status;
}

function NewExpenseForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExpenseClaim();
  const { toast } = useToast();
  const [expenseType, setExpenseType] = useState<ExpenseType>("Travel");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [receiptRef, setReceiptRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validAmount = amount !== "" && Number(amount) > 0;
  const ready = validAmount && description.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validAmount) {
      setError("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      setError("Please add a description");
      return;
    }
    try {
      await createMutation.mutateAsync({
        expenseType,
        amount: Number(amount),
        expenseDate,
        description: description.trim(),
        ...(receiptRef.trim() ? { receiptRef: receiptRef.trim() } : {}),
      });
      toast({ title: "Expense submitted for approval.", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to submit. Please try again.",
      );
    }
  }

  return (
    <Card className="animate-reveal">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Receipt className="h-4 w-4 text-brand-500" aria-hidden="true" />
        New Expense Claim
      </h2>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="space-y-1.5">
          <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Expense Type
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Expense type"
          >
            {EXPENSE_TYPES.map((t) => {
              const active = expenseType === t;
              return (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setExpenseType(t)}
                  className="rounded-full text-xs font-semibold"
                >
                  {t}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            label="Amount (₹)"
            required
            hint={validAmount ? `₹${rupees(Number(amount))}` : undefined}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Date"
            required
            labelAction={
              <Button
                type="button"
                size="sm"
                variant={expenseDate === todayIso() ? "secondary" : "ghost"}
                className="h-6 rounded-full px-2.5 text-[10px]"
                onClick={() => setExpenseDate(todayIso())}
              >
                Today
              </Button>
            }
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                max={todayIso()}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Receipt / Bill Number">
            {(f) => (
              <Input
                {...f}
                placeholder="e.g. INV-1234"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Description"
          required
          labelAction={
            <span className="text-[10px] tabular-nums text-gray-400">
              {description.length}/300
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              maxLength={300}
              placeholder="Describe the expense..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        {amount || description.trim() ? (
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-green-500" : "bg-amber-400"}`}
            />
            {ready
              ? "Ready to submit — looks good!"
              : !validAmount
                ? "Enter a valid amount to continue"
                : "Add a description to continue"}
          </p>
        ) : null}

        {error ? (
          <Alert variant="error" title="Could not submit">
            {error}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!ready}
          >
            Submit Claim
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * The employee's expense claims, laid out like the legacy page
 * (TexaWave_ERP_old src/modules/employee/MyExpenses.tsx): header with a
 * New Expense toggle, Pending / Approved / Rejected summary tiles (with
 * rupee totals), the inline claim form, then claims grouped by expense type
 * in collapsible category sections.
 */
export function MyExpenseClaimsView() {
  const query = useMyExpenseClaims();
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to expense claims"
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const expenses = [...query.data].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const amountOf = (c: MyExpenseClaim) => Number(c.amount);
  const totalFor = (s: Status) =>
    expenses
      .filter((e) => statusOf(e) === s)
      .reduce((sum, e) => sum + amountOf(e), 0);

  const grouped = EXPENSE_TYPES.map(
    (type) => [type, expenses.filter((e) => e.expenseType === type)] as const,
  ).filter(([, items]) => items.length > 0);

  function toggle(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Expenses
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Submit and track your expense claims
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus
            className={`h-4 w-4 transition-transform ${showForm ? "rotate-45" : ""}`}
            aria-hidden="true"
          />
          {showForm ? "Cancel" : "New Expense"}
        </Button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = expenses.filter((e) => statusOf(e) === s).length;
          const total = totalFor(s);
          return (
            <Card
              key={s}
              className="flex h-full flex-col items-center justify-center p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <cfg.icon
                className="mx-auto mb-1 h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {count}
              </p>
              <p
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}
              >
                {cfg.label}
              </p>
              {s === "APPROVED" && total > 0 ? (
                <p className="mt-1 text-xs font-medium text-green-600">
                  ₹{rupees(total)}
                </p>
              ) : null}
              {s === "PENDING" && total > 0 ? (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  ₹{rupees(total)}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {showForm ? <NewExpenseForm onClose={() => setShowForm(false)} /> : null}

      {expenses.length === 0 ? (
        <Card className="py-12 text-center text-gray-500 dark:text-gray-400">
          <Receipt
            className="mx-auto mb-2 h-10 w-10 opacity-30"
            aria-hidden="true"
          />
          <p className="text-sm">No expenses submitted yet</p>
          <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Submit your first expense
          </Button>
        </Card>
      ) : (
        grouped.map(([category, items]) => {
          const isCollapsed = collapsed.has(category);
          const catTotal = items.reduce((sum, e) => sum + amountOf(e), 0);
          return (
            <div key={category}>
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(category)}
                className={`mb-2 flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
                }`}
              >
                <span className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  {category}
                  <span className="text-xs font-normal opacity-70">
                    ({items.length} claim{items.length > 1 ? "s" : ""})
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <IndianRupee className="h-3 w-3" aria-hidden="true" />
                  {rupees(catTotal)}
                </span>
              </button>

              {!isCollapsed ? (
                <Card className="overflow-hidden p-0">
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((expense) => {
                      const s = statusOf(expense);
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <li
                          key={expense.id}
                          className="p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                                <IndianRupee
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                {rupees(amountOf(expense))}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                {expense.description}
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span>{expense.expenseDate}</span>
                                {expense.receiptRef ? (
                                  <span>Receipt: {expense.receiptRef}</span>
                                ) : null}
                              </div>
                              {expense.decisionNote ? (
                                <div
                                  className={`mt-2 rounded border p-2 text-xs ${
                                    s === "APPROVED"
                                      ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
                                      : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                                  }`}
                                >
                                  <span className="font-semibold">HR: </span>
                                  {expense.decisionNote}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}
                            >
                              <cfg.icon
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              {cfg.label}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
