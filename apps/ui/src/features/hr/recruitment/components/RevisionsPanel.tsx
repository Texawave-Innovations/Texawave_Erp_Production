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
import {
  ArrowLeft,
  Download,
  Eye,
  Edit2,
  FileText,
  List,
  Plus,
  Printer,
  Search,
  UserCheck,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
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
import type { RevisionFormValues } from "../schema";
import { DetailList } from "./DetailList";
import {
  RevisionForm,
  type RevisionEmployee,
  type RevisionFormExtra,
  emptyRevisionValues,
} from "./RevisionForm";
import {
  RevisionLetterDocument,
  type RevisionLetterDocumentData,
} from "./RevisionLetterDocument";

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
    department: emp.team.name,
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
  const [activeSubTab, setActiveSubTab] = useState<"workspace" | "history">(
    "workspace",
  );
  const [issueFor, setIssueFor] = useState<RevisionEmployee | null>(null);
  const [editTarget, setEditTarget] = useState<RevisionLetterView | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Revision Letter
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Generate and manage salary revision letters for employees.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("workspace")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
              activeSubTab === "workspace"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Issue Revision
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("history")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
              activeSubTab === "history"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Revision History
          </button>
        </div>
      </div>

      {activeSubTab === "workspace" ? (
        issueFor || editTarget ? (
          <RevisionWorkspace
            employee={issueFor}
            editLetter={editTarget}
            onBack={() => {
              setIssueFor(null);
              setEditTarget(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-8">
            <EmployeePicker
              canWrite={canWrite}
              canRead={canReadEmployees}
              onPickEmployee={(emp) => setIssueFor(emp)}
            />
            <RevisionHistory
              canWrite={canWrite}
              onEditLetter={(letter) => setEditTarget(letter)}
            />
          </div>
        )
      ) : (
        <RevisionHistory
          canWrite={canWrite}
          onEditLetter={(letter) => {
            setEditTarget(letter);
            setActiveSubTab("workspace");
          }}
        />
      )}
    </div>
  );
}

/**
 * Screen 4 Two-Column Workspace: Left form + Right live RevisionLetterDocument preview
 */
function RevisionWorkspace({
  employee,
  editLetter,
  onBack,
}: {
  employee: RevisionEmployee | null;
  editLetter: RevisionLetterView | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateRevision();
  const updateMutation = useUpdateRevision();

  const [formState, setFormState] = useState<RevisionFormValues | null>(null);
  const [formExtra, setFormExtra] = useState<RevisionFormExtra | null>(null);

  const previewData: RevisionLetterDocumentData = useMemo(() => {
    const empName =
      editLetter?.employeeName ?? employee?.name ?? "Employee Name";
    const empCode =
      editLetter?.employee.employeeCode ??
      (employee ? `EMP-${String(employee.id).padStart(6, "0")}` : "EMP-000001");
    const desig =
      formState?.designation ||
      editLetter?.designation ||
      employee?.designation ||
      "Designation";
    const dept = employee?.department ?? "Software Department";
    const currCtc = parseFloat(formExtra?.currentCtc || "1000000") || 1000000;

    return {
      ...(editLetter?.documentNo ? { documentNo: editLetter.documentNo } : {}),
      employeeName: empName,
      employeeCode: empCode,
      designation: desig,
      department: dept,
      location: formState?.location || "Chennai",
      letterDate:
        formState?.letterDate || new Date().toISOString().slice(0, 10),
      effectiveDate: formState?.effectiveDate || "",
      revisionType: formExtra?.revisionType || "Annual Appraisal",
      currentComponents: {
        basic: ((currCtc * 0.35) / 12).toFixed(2),
        hra: ((currCtc * 0.3) / 12).toFixed(2),
        ca: ((currCtc * 0.2) / 12).toFixed(2),
        da: ((currCtc * 0.15) / 12).toFixed(2),
      },
      components: {
        basic: formState?.basic || "",
        da: formState?.da || "",
        hra: formState?.hra || "",
        ca: formState?.ca || "",
      },
      signatoryName: formState?.signatoryName || "Amanullah Khan",
      signatoryDesignation: formState?.signatoryDesignation || "Co-Founder",
    };
  }, [employee, editLetter, formState, formExtra]);

  async function handleIssue(input: CreateRevisionLetterInput) {
    await createMutation.mutateAsync(input);
    toast({ title: "Revision letter issued", variant: "success" });
    onBack();
  }

  async function handleUpdate(input: CreateRevisionLetterInput) {
    if (!editLetter) return;
    const { employeeId: _empId, ...changes } = input;
    await updateMutation.mutateAsync({ id: editLetter.id, input: changes });
    toast({ title: "Revision letter updated", variant: "success" });
    onBack();
  }

  const handleValuesChange = useCallback(
    (vals: RevisionFormValues, extra: RevisionFormExtra) => {
      setFormState(vals);
      setFormExtra(extra);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to employee directory
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Section — Revision details and configuration */}
        <div className="lg:col-span-6 xl:col-span-5">
          <Card className="p-5 md:p-6 shadow-theme-xs">
            <div className="mb-5 border-b border-gray-200 pb-3 dark:border-gray-800">
              <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                Revision Details
              </h3>
              <p className="text-theme-xs text-gray-500">
                Enter the revision and compensation details for{" "}
                {editLetter?.employeeName ?? employee?.name}.
              </p>
            </div>

            {editLetter ? (
              <RevisionForm
                key={`edit-${editLetter.id}`}
                initial={editLetter}
                onSubmit={handleUpdate}
                onCancel={onBack}
                submitLabel="Save changes"
                onValuesChange={handleValuesChange}
              />
            ) : employee ? (
              <RevisionForm
                key={`issue-${employee.id}`}
                employee={employee}
                onSubmit={handleIssue}
                onCancel={onBack}
                submitLabel="Issue revision letter"
                onValuesChange={handleValuesChange}
              />
            ) : null}
          </Card>
        </div>

        {/* Right Section — Live output preview */}
        <div className="lg:col-span-6 xl:col-span-7 sticky top-6">
          <Card className="p-4 md:p-6 shadow-theme-xs bg-gray-50/50 dark:bg-gray-900/40">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
              <div>
                <h3 className="text-theme-base font-bold text-gray-900 dark:text-white/90">
                  Document Preview
                </h3>
                <p className="text-theme-xs text-gray-500">
                  Preview of the revision letter with compensation comparison
                  table.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>

            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl p-1">
              <RevisionLetterDocument
                data={previewData}
                onPrint={() => window.print()}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmployeePicker({
  canWrite,
  canRead,
  onPickEmployee,
}: {
  canWrite: boolean;
  canRead: boolean;
  onPickEmployee: (emp: RevisionEmployee) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useRecruitmentEmployees(
    {
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
    canRead,
  );

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
                  <span className="font-mono text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                    {emp.employeeCode}
                  </span>
                ),
              },
              {
                header: "Name",
                cell: (emp) => (
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    {emp.fullName}
                  </span>
                ),
              },
              { header: "Designation", cell: (emp) => emp.designation.name },
              { header: "Team / Department", cell: (emp) => emp.team.name },
              {
                header: "Actions",
                className: "text-right",
                cell: (emp) =>
                  canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPickEmployee(toRevisionEmployee(emp))}
                      aria-label={`Issue revision letter to ${emp.fullName}`}
                      className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      <FileText className="h-3.5 w-3.5" />
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
            Employees Directory
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Pick an employee to issue a salary revision letter with live
            comparison preview.
          </p>
        </div>
        {canRead ? (
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="search"
              aria-label="Search employees"
              placeholder="Search name or employee ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        ) : null}
      </div>

      {body}
    </section>
  );
}

function RevisionHistory({
  canWrite,
  onEditLetter,
}: {
  canWrite: boolean;
  onEditLetter?: (letter: RevisionLetterView) => void;
}) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);

  const query = useRevisions({ page, limit: PAGE_SIZE });
  const detail = useRevision(detailId ?? undefined);

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
                  <span className="font-mono text-theme-xs font-bold text-gray-800 dark:text-gray-200">
                    {item.documentNo}
                  </span>
                ),
              },
              {
                header: "Employee",
                cell: (item) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
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
                  <span className="whitespace-nowrap font-bold text-gray-900 dark:text-white">
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
                      className="inline-flex items-center gap-1 text-theme-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    {canWrite && onEditLetter ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditLetter(item)}
                        aria-label={`Edit revision ${item.documentNo}`}
                        className="inline-flex items-center gap-1 text-theme-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
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
          Revision Letters History
        </h2>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Every issued revision letter with full compensation records.
        </p>
      </div>

      {body}

      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Revision letter details"
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        {detail.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : detail.isError ? (
          <Alert variant="error" title="Could not load revision letter">
            {apiErrorMessage(detail.error, "Try again in a moment.")}
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            <RevisionLetterDocument
              data={{
                documentNo: detail.data.documentNo,
                employeeName: detail.data.employeeName,
                employeeCode: detail.data.employee.employeeCode,
                designation: detail.data.designation,
                location: detail.data.location,
                letterDate: detail.data.letterDate,
                effectiveDate: detail.data.effectiveDate,
                components: detail.data.components,
                signatoryName: detail.data.signatoryName,
                signatoryDesignation: detail.data.signatoryDesignation,
              }}
              onPrint={() => window.print()}
            />
          </div>
        )}
      </Dialog>
    </section>
  );
}
