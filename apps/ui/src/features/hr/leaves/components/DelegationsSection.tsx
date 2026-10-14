"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { useAuthStore } from "@/stores/auth-store";
import { leaveErrorMessage } from "../errors";
import {
  useCreateLeaveDelegation,
  useDelegationCandidates,
  useLeaveDelegations,
  useRevokeLeaveDelegation,
} from "../hooks";
import type { LeaveDelegationItem } from "../types";

const PAGE_SIZE = 10;
const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

function NewDelegationDialog({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [delegateUserId, setDelegateUserId] = useState(0);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const candidates = useDelegationCandidates(search.trim());
  const mutation = useCreateLeaveDelegation();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!delegateUserId) return setError("Choose who approves for you.");
    if (endDate < startDate)
      return setError("The end date is before the start date.");
    const trimmed = reason.trim();
    if (trimmed !== "" && trimmed.length < 3) {
      return setError(
        "The reason must be at least 3 characters, or left empty.",
      );
    }
    setError(null);
    try {
      await mutation.mutateAsync({
        delegateUserId,
        startDate,
        endDate,
        ...(trimmed ? { reason: trimmed } : {}),
      });
      toast({ title: "Delegation created", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        leaveErrorMessage(
          err,
          "You don't have permission to delegate approval.",
        ),
      );
    }
  }

  return (
    <Dialog open onClose={onClose} title="Delegate leave approval">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          While the delegation lasts, the person you choose can approve or
          reject the leave of the people who report to you. Up to 90 days, one
          delegation at a time.
        </p>
        <FormField label="Search approvers">
          {(f) => (
            <Input
              {...f}
              placeholder="Type a name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Approves for me" required>
          {(f) => (
            <Select
              {...f}
              value={delegateUserId || ""}
              disabled={candidates.isPending}
              onChange={(e) => setDelegateUserId(Number(e.target.value))}
            >
              <option value="">
                {candidates.isPending ? "Loading…" : "Choose a person"}
              </option>
              {(candidates.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="From" required>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="To" required>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Reason" hint="Optional, e.g. On leave.">
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
        {error ? (
          <Alert variant="error" title="Could not create the delegation">
            {error}
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Delegate
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * A leave approver's stand-ins (GET/POST /hr/leave-delegations): the
 * delegations the caller gave (revocable) and received. A delegate decides
 * only what the delegator could as reporting manager (Docs/HR_LEAVE.md §6.2).
 */
export function DelegationsSection() {
  const userId = useAuthStore((s) => s.user?.userId ?? 0);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useLeaveDelegations({ page, limit: PAGE_SIZE });
  const revoke = useRevokeLeaveDelegation();
  const { toast } = useToast();

  async function handleRevoke(d: LeaveDelegationItem) {
    try {
      await revoke.mutateAsync(d.id);
      toast({ title: "Delegation revoked", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not revoke",
        description: leaveErrorMessage(
          err,
          "You can revoke only your own delegations.",
        ),
        variant: "error",
      });
    }
  }

  const live = (d: LeaveDelegationItem) =>
    d.isActive && d.endDate >= todayStr();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Approval delegations
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Let someone approve your team&apos;s leave while you are away.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Delegate approval
        </Button>
      </div>

      {list.isPending ? (
        <TableSkeleton rowsCount={3} columnsCount={5} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No delegations"
            description="Delegations you give or receive appear here."
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Leave approval delegations"
            rows={list.data.data}
            getRowKey={(d) => String(d.id)}
            columns={[
              {
                header: "Direction",
                cell: (d) =>
                  d.delegator.id === userId
                    ? `You → ${d.delegate.fullName}`
                    : `${d.delegator.fullName} → you`,
              },
              {
                header: "Dates",
                cell: (d) => (
                  <span className="whitespace-nowrap">
                    {d.startDate === d.endDate
                      ? d.startDate
                      : `${d.startDate} – ${d.endDate}`}
                  </span>
                ),
              },
              { header: "Reason", cell: (d) => d.reason ?? "—" },
              {
                header: "Status",
                cell: (d) => (
                  <StatusBadge
                    label={
                      !d.isActive ? "Revoked" : live(d) ? "Active" : "Ended"
                    }
                    colorToken={
                      !d.isActive ? "gray" : live(d) ? "success" : "gray"
                    }
                  />
                ),
              },
              {
                header: "Actions",
                cell: (d) =>
                  d.delegator.id === userId && d.isActive ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={revoke.isPending}
                      onClick={() => void handleRevoke(d)}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  ),
              },
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {creating ? (
        <NewDelegationDialog onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}
