"use client";

import { useEffect, useState } from "react";
import { Download, Pencil, Upload } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Pagination,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { exportLeaveBalancesCsv } from "../api";
import { leaveErrorMessage } from "../errors";
import { useLeaveBalanceReport } from "../hooks";
import { EXPORT_ANY_SCOPE, LEAVE_TYPE_WRITE } from "../permissions";
import type { EmployeeBalanceRow } from "../types";
import { ImportEntitlementsDialog } from "./ImportEntitlementsDialog";
import { SetEntitlementDialog } from "./SetEntitlementDialog";

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type Editing = {
  row: EmployeeBalanceRow;
  balance: EmployeeBalanceRow["balances"][number];
} | null;

/**
 * Leave allotment — the legacy "Leave Allotment" tab, built on
 * GET /hr/leave-requests/balances/report: every employee in scope with each
 * active leave type's entitlement (Custom override or the type Default) and
 * what is still available. HR edits one cell, imports a CSV for many, or
 * exports the whole year (Docs/HR_LEAVE.md §5, §6).
 */
export function AllotmentSection() {
  const canWrite = usePermission(LEAVE_TYPE_WRITE);
  const canExport = usePermission(EXPORT_ANY_SCOPE);
  const { toast } = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebounced(search.trim());

  const report = useLeaveBalanceReport({
    page,
    limit: PAGE_SIZE,
    year,
    ...(debounced ? { search: debounced } : {}),
  });
  const types = report.data?.data[0]?.balances ?? [];

  async function handleExport() {
    setExporting(true);
    try {
      await exportLeaveBalancesCsv({
        year,
        ...(debounced ? { search: debounced } : {}),
      });
    } catch (err) {
      toast({
        title: "Could not export",
        description: leaveErrorMessage(
          err,
          "You don't have permission to export leave.",
        ),
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Leave allotment
          </h2>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Annual entitlement per employee and leave type, and what is still
            available. <strong>Custom</strong> overrides the leave type default
            for that year only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <Button
              variant="secondary"
              loading={exporting}
              onClick={() => void handleExport()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
          {canWrite ? (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" />
              Import CSV
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Year">
          {(f) => (
            <Select
              {...f}
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
            >
              {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Search">
          {(f) => (
            <Input
              {...f}
              placeholder="Name or employee code"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          )}
        </FormField>
      </Card>

      {report.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={5} />
      ) : report.isError ? (
        report.error instanceof ApiError && report.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to leave balances"
          >
            Ask an administrator for <code>hr.leave_request.read</code>.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void report.refetch()} />
        )
      ) : report.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              debounced ? "No employees match" : "No employees in your scope"
            }
            description={
              types.length === 0 && !debounced
                ? "Employees employed during the year appear here."
                : "Try another name or code."
            }
          />
        </Card>
      ) : types.length === 0 ? (
        <Alert variant="info" title="No active leave types">
          Create leave types first; their entitlements appear here.
        </Alert>
      ) : (
        <>
          <DataTable
            caption={`Leave allotment ${year}`}
            rows={report.data.data}
            getRowKey={(r) => String(r.employee.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <EmployeeIdentity
                    name={r.employee.fullName}
                    code={r.employee.employeeCode}
                    size="sm"
                  />
                ),
              },
              ...types.map((t) => ({
                header: t.name,
                cell: (r: EmployeeBalanceRow) => {
                  const b = r.balances.find(
                    (x) => x.leaveTypeId === t.leaveTypeId,
                  );
                  if (!b) return "—";
                  return (
                    <div className="flex min-w-[8rem] items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-900 dark:text-white/90">
                          {b.entitlement}
                          <span className="ml-1 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                            / yr
                          </span>
                        </span>
                        <StatusBadge
                          label={b.isOverride ? "Custom" : "Default"}
                          colorToken={b.isOverride ? "brand" : "gray"}
                        />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {b.available === null
                            ? `Unpaid · used ${b.used}`
                            : `Available ${b.available} · used ${b.used}`}
                        </span>
                      </div>
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${t.name} for ${r.employee.fullName}`}
                          onClick={() => setEditing({ row: r, balance: b })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  );
                },
              })),
            ]}
          />
          <Pagination
            page={report.data.meta.page}
            totalPages={report.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {editing ? (
        <SetEntitlementDialog
          open
          onClose={() => setEditing(null)}
          leaveType={{
            id: editing.balance.leaveTypeId,
            name: editing.balance.name,
          }}
          employee={{
            id: editing.row.employee.id,
            employeeCode: editing.row.employee.employeeCode,
            fullName: editing.row.employee.fullName,
          }}
          year={year}
          current={editing.balance.entitlement}
          isOverride={editing.balance.isOverride}
        />
      ) : null}
      {importOpen ? (
        <ImportEntitlementsDialog
          open
          onClose={() => setImportOpen(false)}
          year={year}
        />
      ) : null}
    </div>
  );
}
