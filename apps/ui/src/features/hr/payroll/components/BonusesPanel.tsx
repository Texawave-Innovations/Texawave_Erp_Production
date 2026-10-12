"use client";

import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { describeError, isoDate, money, periodLabel } from "../format";
import { useBonuses, useCreateBonus, useDecideBonus } from "../hooks";
import { BONUS_APPROVE, BONUS_WRITE } from "../permissions";
import { createBonusSchema, fieldErrors } from "../schema";
import {
  BONUS_FILTER_STATUSES,
  BONUS_TYPES,
  type Bonus,
  type BonusType,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { OpenPeriodSelect } from "./OpenPeriodSelect";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<BonusType, string> = {
  FESTIVAL: "Festival",
  PERFORMANCE: "Performance",
  STATUTORY: "Statutory",
  ANNUAL: "Annual",
  SPOT: "Spot",
};

function NewBonusDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateBonus();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [bonusType, setBonusType] = useState<BonusType | "">("");
  const [amount, setAmount] = useState("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createBonusSchema.safeParse({
      employeeId: employee?.id,
      bonusType: bonusType || undefined,
      amount,
      payrollPeriodId: periodId ?? undefined,
      reason,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await create.mutateAsync(parsed.data);
      toast({
        title: `Bonus created for ${employee?.fullName} — awaiting approval`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog open onClose={onClose} title="New bonus">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Employee" required error={errors.employeeId}>
          {(f) => (
            <EmployeePicker {...f} value={employee} onChange={setEmployee} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Bonus type" required error={errors.bonusType}>
            {(f) => (
              <Select
                {...f}
                value={bonusType}
                onChange={(e) => setBonusType(e.target.value as BonusType)}
              >
                <option value="">Choose a type</option>
                {BONUS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Amount (₹)" required error={errors.amount}>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Pay with payroll period"
          hint="Optional. An approved bonus is paid by this period's payroll run."
          error={errors.payrollPeriodId}
        >
          {(f) => (
            <OpenPeriodSelect
              {...f}
              value={periodId}
              onChange={setPeriodId}
              emptyLabel="Not assigned yet"
            />
          )}
        </FormField>
        <FormField label="Reason" hint="Optional." error={errors.reason}>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Create bonus"
        />
      </form>
    </Dialog>
  );
}

function DecideBonusDialog({
  bonus,
  decision,
  onClose,
}: {
  bonus: Bonus;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
}) {
  const decide = useDecideBonus();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const approving = decision === "APPROVED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    try {
      await decide.mutateAsync({
        id: bonus.id,
        decision,
        note: note.trim() || undefined,
      });
      toast({
        title: approving ? "Bonus approved" : "Bonus rejected",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={approving ? "Approve bonus" : "Reject bonus"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {TYPE_LABEL[bonus.bonusType]} bonus of{" "}
          <strong>{money(bonus.amount)}</strong> for {bonus.employee.fullName}
          {bonus.payrollPeriod
            ? `, paid with ${periodLabel(bonus.payrollPeriod)}`
            : ""}
          .
        </p>
        <FormField label="Note" hint="Optional.">
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={decide.isPending}
          submitLabel={approving ? "Approve" : "Reject"}
          destructive={!approving}
        />
      </form>
    </Dialog>
  );
}

/** HR → Payroll → Bonuses: create, review and approve bonuses. An approved
 * bonus assigned to a period is paid by that period's payroll run. */
export function BonusesPanel() {
  const canWrite = usePermission(BONUS_WRITE);
  const canApprove = usePermission(BONUS_APPROVE);
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<
    (typeof BONUS_FILTER_STATUSES)[number] | ""
  >("PENDING");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{
    bonus: Bonus;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const query = useBonuses({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(periodId ? { payrollPeriodId: periodId } : {}),
  });
  const rows = query.data?.data ?? [];

  // Maker-checker, mirrored from the API: the creator and the recipient
  // may not decide a bonus.
  const mayDecide = (b: Bonus) =>
    canApprove &&
    b.status === "PENDING" &&
    userId != null &&
    b.createdBy !== userId &&
    b.employee.userId !== userId;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <Select
              aria-label="Filter by bonus status"
              className="w-full sm:w-44"
              value={status}
              onChange={(e) => {
                setStatus(
                  e.target.value as (typeof BONUS_FILTER_STATUSES)[number] | "",
                );
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {BONUS_FILTER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
          </div>
          {canWrite ? (
            <Button onClick={() => setCreating(true)}>New bonus</Button>
          ) : null}
        </div>
      </Card>

      <QueryState query={query} area="bonuses" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No bonuses"
            description={
              status === "PENDING"
                ? "Nothing is waiting for approval."
                : "No bonuses match these filters."
            }
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <>
          <DataTable<Bonus>
            caption="Bonuses"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{r.employee.fullName}</span>
                    <span className="text-theme-xs text-gray-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
              { header: "Type", cell: (r) => TYPE_LABEL[r.bonusType] },
              {
                header: "Amount",
                cell: (r) => money(r.amount),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Period",
                cell: (r) =>
                  r.payrollPeriod ? periodLabel(r.payrollPeriod) : "—",
              },
              { header: "Reason", cell: (r) => r.reason ?? "—" },
              {
                header: "Status",
                cell: (r) => (
                  <span className="flex flex-col items-start gap-0.5">
                    <StatusPill status={r.status} />
                    {r.approver ? (
                      <span className="text-theme-xs text-gray-500">
                        by {r.approver.fullName} · {isoDate(r.approvedAt)}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "Actions",
                cell: (r) =>
                  mayDecide(r) ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        aria-label={`Approve bonus for ${r.employee.fullName}`}
                        onClick={() =>
                          setDeciding({ bonus: r, decision: "APPROVED" })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        aria-label={`Reject bonus for ${r.employee.fullName}`}
                        onClick={() =>
                          setDeciding({ bonus: r, decision: "REJECTED" })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : canApprove && r.status === "PENDING" ? (
                    <span className="text-theme-xs text-gray-600 dark:text-gray-400">
                      Someone else must decide
                    </span>
                  ) : null,
              },
            ]}
          />
          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}

      {creating ? <NewBonusDialog onClose={() => setCreating(false)} /> : null}
      {deciding ? (
        <DecideBonusDialog
          bonus={deciding.bonus}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </div>
  );
}
