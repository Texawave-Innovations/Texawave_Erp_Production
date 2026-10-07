"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useCreateEmployee, useEmployee, useUpdateEmployee } from "../hooks";
import {
  buildCreatePayload,
  buildUpdatePayload,
  formFromDetail,
  type EmployeeFormValues,
} from "../schema";
import { WRITE_TEAM_OR_ALL } from "../permissions";
import { EmployeeForm } from "./EmployeeForm";

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to change employees">
      Ask an administrator for the <code>hr.employee.write</code> permission.
    </Alert>
  );
}

export function EmployeeCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const createMutation = useCreateEmployee();

  if (!canWrite) return <NoWriteAccess />;

  async function handleSubmit(values: EmployeeFormValues) {
    const created = await createMutation.mutateAsync(
      buildCreatePayload(values),
    );
    toast({
      title: `${created.fullName} added as ${created.employeeCode}`,
      variant: "success",
    });
    router.push(`/hr/employees/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/hr/employees"
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to employees
      </Link>
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        New employee
      </h1>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        The employee code is generated when you save. New employees start as
        Active.
      </p>
      <Card>
        <EmployeeForm
          submitLabel="Create employee"
          onSubmit={handleSubmit}
          onCancel={() => router.push("/hr/employees")}
        />
      </Card>
    </div>
  );
}

export function EmployeeEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const query = useEmployee(id);
  const updateMutation = useUpdateEmployee();

  if (!canWrite) return <NoWriteAccess />;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card>
          <EmptyState
            title="Employee not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="text-brand-600 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </Card>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const employee = query.data;
  const initial = formFromDetail(employee);

  async function handleSubmit(values: EmployeeFormValues) {
    const body = buildUpdatePayload(initial, values, employee.version);
    if (Object.keys(body).length === 1) {
      // Only `version` is left, so nothing changed. Skip the request.
      router.push(`/hr/employees/${id}`);
      return;
    }
    await updateMutation.mutateAsync({ id, body });
    toast({ title: "Employee updated", variant: "success" });
    router.push(`/hr/employees/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/hr/employees/${id}`}
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to {employee.fullName}
      </Link>
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Edit employee
      </h1>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {employee.employeeCode}. Status changes are made from the employee
        record, not here.
      </p>
      <Card>
        <EmployeeForm
          initialValues={initial}
          initialManager={
            employee.reportsTo
              ? {
                  id: employee.reportsTo.id,
                  label: `${employee.reportsTo.fullName} (${employee.reportsTo.employeeCode})`,
                }
              : null
          }
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/hr/employees/${id}`)}
        />
      </Card>
    </div>
  );
}
