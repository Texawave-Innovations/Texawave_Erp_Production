"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateRevision,
  useRecruitmentEmployees,
  useRevision,
  useRevisions,
  useUpdateRevision,
} from "../hooks";
import type {
  CreateRevisionLetterInput,
  RecruitmentEmployee,
  RevisionLetterView,
} from "../types";
import {
  apiErrorMessage,
  formatDate,
  formatRupees,
  useDebouncedValue,
} from "../utils";
import { DetailList } from "./DetailList";
import { RevisionForm, type RevisionEmployee } from "./RevisionForm";

const PAGE_SIZE = 10;

export interface RevisionsPanelProps {
  canWrite: boolean;
  canReadEmployees: boolean;
}

function toRevisionEmployee(emp: RecruitmentEmployee): RevisionEmployee {
  return {
    id: emp.id,
    name: emp.fullName,
    designation: emp.designation.name,
  };
}

/** Errors from a read are shown inline; a 403 gets its own wording. */
function ReadError({
  error,
  onRetry,
  what,
}: {
  error: unknown;
  onRetry: () => void;
  what: string;
}) {
  if (error instanceof ApiError && error.isPermissionError) {
    return (
      <Alert variant="warning" title="Access denied">
        You do not have permission to view {what}.
      </Alert>
    );
  }
  return <ErrorState onRetry={onRetry} />;
}

export function RevisionsPanel({
  canWrite,
  canReadEmployees,
}: RevisionsPanelProps) {
  return (
    <div className="flex flex-col gap-8">
      <EmployeePicker canWrite={canWrite} canRead={canReadEmployees} />
      <RevisionHistory canWrite={canWrite} />
    </div>
  );
}

function EmployeePicker({
  canWrite,
  canRead,
}: {
  canWrite: boolean;
  canRead: boolean;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [issueFor, setIssueFor] = useState<RevisionEmployee | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useRecruitmentEmployees(
    {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
    canRead,
  );
  const createMutation = useCreateRevision();

  async function handleIssue(input: CreateRevisionLetterInput) {
    await createMutation.mutateAsync(input);
    setIssueFor(null);
    toast({ title: "Revision letter issued", variant: "success" });
  }

  let body: React.ReactNode;
  if (!canRead) {
    body = (
      <Alert variant="warning" title="Employee list unavailable">
        You do not have permission to view employees, so you cannot pick one
        here.
      </Alert>
    );
  } else if (query.isPending) {
    body = <Skeleton className="h-40 w-full" />;
  } else if (query.isError) {
    body = (
      <ReadError
        error={query.error}
        onRetry={() => void query.refetch()}
        what="employees"
      />
    );
  } else {
    const rows = query.data.data;
    const meta = query.data.meta;
    body =
      rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No employees found"
            description={
              debouncedSearch
                ? "Try a different search."
                : "Employees in your scope will appear here."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<RecruitmentEmployee>
            caption="Employees for revision letters"
            rows={rows}
            getRowKey={(emp) => String(emp.id)}
            columns={[
              {
                header: "Employee ID",
                cell: (emp) => (
                  <span className="font-mono text-theme-xs">
                    {emp.employeeCode}
                  </span>
                ),
              },
              {
                header: "Name",
                cell: (emp) => (
                  <span className="font-medium text-gray-900 dark:text-white/90">
                    {emp.fullName}
                  </span>
                ),
              },
              { header: "Designation", cell: (emp) => emp.designation.name },
              { header: "Team", cell: (emp) => emp.team.name },
              {
                header: "Actions",
                className: "text-right",
                cell: (emp) =>
                  canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIssueFor(toRevisionEmployee(emp))}
                      aria-label={`Issue revision letter to ${emp.fullName}`}
                    >
                      Revision letter
                    </Button>
                  ) : null,
              },
            ]}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      );
  }

  return (
    <section
      aria-labelledby="revision-employees"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="revision-employees"
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            Employees
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Pick an employee to issue a salary revision letter.
          </p>
        </div>
        {canRead ? (
          <Input
            type="search"
            aria-label="Search employees"
            placeholder="Search name or employee ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="md:max-w-xs"
          />
        ) : null}
      </div>

      {body}

      <Dialog
        open={issueFor !== null}
        onClose={() => setIssueFor(null)}
        title={
          issueFor ? `Revision letter for ${issueFor.name}` : "Revision letter"
        }
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {issueFor ? (
          <RevisionForm
            employee={issueFor}
            onSubmit={handleIssue}
            onCancel={() => setIssueFor(null)}
            submitLabel="Issue revision letter"
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function RevisionHistory({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const query = useRevisions({ page, limit: PAGE_SIZE });
  const updateMutation = useUpdateRevision();
  const detail = useRevision(detailId ?? undefined);
  const editTarget = useRevision(editId ?? undefined);

  async function handleUpdate(input: CreateRevisionLetterInput) {
    if (editId === null) return;
    // The employee link is immutable; the backend rejects it on edit.
    const { employeeId: _employeeId, ...changes } = input;
    await updateMutation.mutateAsync({ id: editId, input: changes });
    setEditId(null);
    toast({ title: "Revision letter updated", variant: "success" });
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = <Skeleton className="h-40 w-full" />;
  } else if (query.isError) {
    body = (
      <ReadError
        error={query.error}
        onRetry={() => void query.refetch()}
        what="revision letters"
      />
    );
  } else {
    const rows = query.data.data;
    const meta = query.data.meta;
    body =
      rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No revision letters yet"
            description="Issued revision letters will appear here."
          />
        </Card>
      ) : (
        <>
          <DataTable<RevisionLetterView>
            caption="Issued revision letters"
            rows={rows}
            getRowKey={(item) => String(item.id)}
            columns={[
              {
                header: "Document no.",
                cell: (item) => (
                  <span className="font-mono text-theme-xs">
                    {item.documentNo}
                  </span>
                ),
              },
              {
                header: "Employee",
                cell: (item) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-white/90">
                      {item.employeeName}
                    </span>
                    <span className="font-mono text-theme-xs text-gray-500">
                      {item.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
              { header: "Designation", cell: (item) => item.designation },
              {
                header: "Effective",
                cell: (item) => formatDate(item.effectiveDate),
              },
              {
                header: "Gross annual",
                cell: (item) => (
                  <span className="whitespace-nowrap font-medium">
                    {formatRupees(item.grossAnnual)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: () => (
                  <StatusBadge label="Generated" colorToken="brand" />
                ),
              },
              {
                header: "Actions",
                className: "text-right",
                cell: (item) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailId(item.id)}
                      aria-label={`View revision ${item.documentNo}`}
                    >
                      View
                    </Button>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditId(item.id)}
                        aria-label={`Edit revision ${item.documentNo}`}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
          />
        </>
      );
  }

  return (
    <section aria-labelledby="revision-history" className="flex flex-col gap-4">
      <div>
        <h2
          id="revision-history"
          className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
        >
          Revision letters
        </h2>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Every issued revision, with its document number.
        </p>
      </div>

      {body}

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Revision letter details"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {detail.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load revision letter">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            <DetailList
              items={[
                { label: "Document no.", value: detail.data.documentNo },
                {
                  label: "Employee",
                  value: `${detail.data.employeeName} (${detail.data.employee.employeeCode})`,
                },
                { label: "Designation", value: detail.data.designation },
                { label: "Location", value: detail.data.location },
                {
                  label: "Letter date",
                  value: formatDate(detail.data.letterDate),
                },
                {
                  label: "Effective date",
                  value: formatDate(detail.data.effectiveDate),
                },
              ]}
            />
            <DetailList
              items={[
                {
                  label: "Basic",
                  value: formatRupees(detail.data.components.basic),
                },
                { label: "DA", value: formatRupees(detail.data.components.da) },
                {
                  label: "HRA",
                  value: formatRupees(detail.data.components.hra),
                },
                { label: "CA", value: formatRupees(detail.data.components.ca) },
                {
                  label: "Gross monthly",
                  value: formatRupees(detail.data.grossMonthly),
                },
                {
                  label: "Gross annual",
                  value: formatRupees(detail.data.grossAnnual),
                },
                {
                  label: "Signatory",
                  value: `${detail.data.signatoryName}, ${detail.data.signatoryDesignation}`,
                },
              ]}
            />
          </div>
        )}
      </Dialog>

      <Dialog
        open={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit revision letter"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {editTarget.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : editTarget.isError ? (
          <Alert variant="error" title="Could not load revision letter">
            {apiErrorMessage(editTarget.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <RevisionForm
            key={editTarget.data.id}
            initial={editTarget.data}
            onSubmit={handleUpdate}
            onCancel={() => setEditId(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>
    </section>
  );
}
