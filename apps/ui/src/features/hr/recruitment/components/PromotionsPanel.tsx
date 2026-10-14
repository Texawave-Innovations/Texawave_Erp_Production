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
  useCreatePromotion,
  usePromotion,
  usePromotions,
  useRecruitmentEmployees,
  useUpdatePromotion,
} from "../hooks";
import type { PromotionLetterView, RecruitmentEmployee } from "../types";
import {
  apiErrorMessage,
  formatDate,
  formatRupees,
  useDebouncedValue,
} from "../utils";
import { DetailList } from "./DetailList";
import {
  PromotionForm,
  type PromotionEmployee,
  type PromotionFormSubmit,
} from "./PromotionForm";
import { SalaryHistory } from "./SalaryHistory";

const PAGE_SIZE = 10;

export interface PromotionsPanelProps {
  canWrite: boolean;
  canReadEmployees: boolean;
  canReadDesignations: boolean;
  canAddDesignation: boolean;
}

function toPromotionEmployee(emp: RecruitmentEmployee): PromotionEmployee {
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

/** Recruitment → Promotion letter: pick an employee (expanding shows their
 * salary history), issue a letter, and browse/edit issued letters. */
export function PromotionsPanel({
  canWrite,
  canReadEmployees,
  canReadDesignations,
  canAddDesignation,
}: PromotionsPanelProps) {
  const formProps = { canReadDesignations, canAddDesignation };
  return (
    <div className="flex flex-col gap-8">
      <EmployeeList
        canWrite={canWrite}
        canRead={canReadEmployees}
        formProps={formProps}
      />
      <PromotionLetters canWrite={canWrite} formProps={formProps} />
    </div>
  );
}

interface FormPermissionProps {
  canReadDesignations: boolean;
  canAddDesignation: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function EmployeeList({
  canWrite,
  canRead,
  formProps,
}: {
  canWrite: boolean;
  canRead: boolean;
  formProps: FormPermissionProps;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [issueFor, setIssueFor] = useState<PromotionEmployee | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useRecruitmentEmployees(
    {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
    canRead,
  );
  const createMutation = useCreatePromotion();

  async function handleIssue(input: PromotionFormSubmit) {
    const { designationId } = input;
    // The form always sends a designation on create; this narrows the type.
    if (designationId === undefined) return;
    await createMutation.mutateAsync({ ...input, designationId });
    setIssueFor(null);
    toast({ title: "Promotion letter issued", variant: "success" });
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
    body = (
      <div role="status" aria-label="Loading employees">
        <Skeleton className="h-40 w-full" />
      </div>
    );
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
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {rows.map((emp) => {
              const open = expandedId === emp.id;
              const panelId = `promotion-history-${emp.id}`;
              return (
                <li key={emp.id}>
                  <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={`${open ? "Hide" : "Show"} salary history of ${emp.fullName}`}
                      onClick={() => setExpandedId(open ? null : emp.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20"
                    >
                      <ChevronIcon open={open} />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium text-gray-900 dark:text-white/90">
                          {emp.fullName}
                        </span>
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono">{emp.employeeCode}</span>
                          {" · "}
                          {emp.designation.name}
                          {" · "}
                          {emp.team.name}
                        </span>
                      </span>
                    </button>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start sm:self-auto"
                        onClick={() => setIssueFor(toPromotionEmployee(emp))}
                        aria-label={`Issue promotion letter to ${emp.fullName}`}
                      >
                        Promotion letter
                      </Button>
                    ) : null}
                  </div>
                  {open ? (
                    <div
                      id={panelId}
                      className="border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/30"
                    >
                      <SalaryHistory employeeId={emp.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={(next) => {
              setPage(next);
              setExpandedId(null);
            }}
          />
        </>
      );
  }

  return (
    <section
      aria-labelledby="promotion-employees"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="promotion-employees"
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            Employees
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Expand an employee to see their past salary revisions and
            promotions, then issue a promotion letter.
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
              setExpandedId(null);
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
          issueFor
            ? `Promotion letter for ${issueFor.name}`
            : "Promotion letter"
        }
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {issueFor ? (
          <PromotionForm
            employee={issueFor}
            {...formProps}
            onSubmit={handleIssue}
            onCancel={() => setIssueFor(null)}
            submitLabel="Issue promotion letter"
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function PromotionLetters({
  canWrite,
  formProps,
}: {
  canWrite: boolean;
  formProps: FormPermissionProps;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const query = usePromotions({ page, limit: PAGE_SIZE });
  const updateMutation = useUpdatePromotion();
  const detail = usePromotion(detailId ?? undefined);
  const editTarget = usePromotion(editId ?? undefined);

  async function handleUpdate(input: PromotionFormSubmit) {
    if (editId === null) return;
    // The employee link is immutable; the backend rejects it on edit.
    const { employeeId: _employeeId, ...changes } = input;
    await updateMutation.mutateAsync({ id: editId, input: changes });
    setEditId(null);
    toast({ title: "Promotion letter updated", variant: "success" });
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div role="status" aria-label="Loading promotion letters">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (query.isError) {
    body = (
      <ReadError
        error={query.error}
        onRetry={() => void query.refetch()}
        what="promotion letters"
      />
    );
  } else {
    const rows = query.data.data;
    const meta = query.data.meta;
    body =
      rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No promotion letters yet"
            description="Issued promotion letters will appear here."
          />
        </Card>
      ) : (
        <>
          <DataTable<PromotionLetterView>
            caption="Issued promotion letters"
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
              {
                header: "Designation",
                cell: (item) => (
                  <span>
                    {item.previousDesignation} → {item.designation}
                  </span>
                ),
              },
              {
                header: "Effective",
                cell: (item) => (
                  <span className="whitespace-nowrap">
                    {formatDate(item.effectiveDate)}
                  </span>
                ),
              },
              {
                header: "Gross monthly",
                cell: (item) => (
                  <span className="whitespace-nowrap font-medium">
                    {formatRupees(item.grossMonthly)}
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
                      aria-label={`View promotion ${item.documentNo}`}
                    >
                      View
                    </Button>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditId(item.id)}
                        aria-label={`Edit promotion ${item.documentNo}`}
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
    <section
      aria-labelledby="promotion-letters"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="promotion-letters"
          className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
        >
          Promotion letters
        </h2>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Every issued promotion, with its document number.
        </p>
      </div>

      {body}

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Promotion letter details"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {detail.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load promotion letter">
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
                {
                  label: "Previous designation",
                  value: detail.data.previousDesignation,
                },
                { label: "New designation", value: detail.data.designation },
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
        title="Edit promotion letter"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {editTarget.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : editTarget.isError ? (
          <Alert variant="error" title="Could not load promotion letter">
            {apiErrorMessage(editTarget.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <PromotionForm
            key={editTarget.data.id}
            initial={editTarget.data}
            {...formProps}
            onSubmit={handleUpdate}
            onCancel={() => setEditId(null)}
            submitLabel="Save changes"
          />
        )}
      </Dialog>
    </section>
  );
}
