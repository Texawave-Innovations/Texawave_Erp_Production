"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderKanban, IndianRupee } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useProjects as useProjectCategories } from "@/features/projects-master/hooks";
import { useAccounts } from "@/features/crm/accounts/hooks";
import { useEmployees } from "@/features/hr/employees/hooks";
import { DepartmentMultiSelect } from "./DepartmentMultiSelect";
import {
  ProjectResourcesGrid,
  filterEmployeesByDepartments,
} from "./ProjectResourcesGrid";
import { toDateInput, todayInput } from "../format";
import type { Project, ProjectStatus } from "../types";

function plusDays(days: number): string {
  const d = new Date(`${todayInput()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ProjectFormProps {
  /** Present when editing. */
  project?: Project | undefined;
  submitting: boolean;
  error?: string | null | undefined;
  cancelHref: string;
  /** Receives the API payload (create or update DTO shape). */
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
}

/** Legacy `ProjectForm.tsx` — one form for create and edit: a gradient
 * header with the project code badge, a "Project Details & Client" card
 * (project type, code, name, customer, scope, multi-department chips,
 * status) and a "Budget, Timelines & Team Resources" card (hours, price,
 * three dates, client handling person and the department-filtered resource
 * grid). */
export function ProjectForm({
  project,
  submitting,
  error,
  cancelHref,
  onSubmit,
}: ProjectFormProps) {
  const isEdit = Boolean(project);

  const [projectType, setProjectType] = useState(project?.projectType ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [customerId, setCustomerId] = useState<string>(
    project?.customerId ? String(project.customerId) : "",
  );
  const [customerName, setCustomerName] = useState(project?.customerName ?? "");
  const [departments, setDepartments] = useState<string[]>(
    project?.departments ?? [],
  );
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? "active",
  );
  const [expectedHours, setExpectedHours] = useState(
    project ? String(Number(project.expectedHours) || 0) : "",
  );
  const [projectPrice, setProjectPrice] = useState(
    project ? String(Number(project.projectPrice) || 0) : "",
  );
  const [startDate, setStartDate] = useState(
    project ? toDateInput(project.startDate) : todayInput(),
  );
  const [plannedEndDate, setPlannedEndDate] = useState(
    project ? toDateInput(project.plannedEndDate) : plusDays(60),
  );
  const [actualEndDate, setActualEndDate] = useState(
    project ? toDateInput(project.actualEndDate) : "",
  );
  const [clientHandlingPersonId, setClientHandlingPersonId] = useState<string>(
    project?.clientHandlingPersonId
      ? String(project.clientHandlingPersonId)
      : "",
  );
  // Canonical legacy resource list is employee *names*.
  const [resourceNames, setResourceNames] = useState<string[]>(
    project?.resourceNames ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const categoriesQuery = useProjectCategories({ limit: 100 });
  const accountsQuery = useAccounts({ limit: 100 });
  const employeesQuery = useEmployees({ page: 1, limit: 100 });
  const allEmployees = useMemo(
    () => employeesQuery.data?.data ?? [],
    [employeesQuery.data],
  );
  const departmentEmployees = useMemo(
    () => filterEmployeesByDepartments(allEmployees, departments),
    [allEmployees, departments],
  );
  const selectedIds = useMemo(
    () =>
      departmentEmployees
        .filter((e) => resourceNames.includes(e.fullName))
        .map((e) => e.id),
    [departmentEmployees, resourceNames],
  );

  function handleResourceIdsChange(ids: number[]) {
    // Keep names the grid can't show (other departments / free-form legacy
    // names) and replace the visible ones with the new selection.
    const visible = new Set(departmentEmployees.map((e) => e.fullName));
    const kept = resourceNames.filter((n) => !visible.has(n));
    const picked = departmentEmployees
      .filter((e) => ids.includes(e.id))
      .map((e) => e.fullName);
    setResourceNames(Array.from(new Set([...kept, ...picked])));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (name.trim().length < 2) {
      setLocalError("Project name is required");
      return;
    }
    if (!startDate) {
      setLocalError("Start date is required");
      return;
    }
    if (plannedEndDate && plannedEndDate < startDate) {
      setLocalError("Planned end date cannot be earlier than the start date.");
      return;
    }

    // Legacy: completing a project stamps today's date if none was entered.
    const effectiveActualEnd =
      status === "completed" ? actualEndDate || todayInput() : actualEndDate;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      projectType: projectType || undefined,
      departments,
      resourceNames,
      customerId: customerId ? Number(customerId) : undefined,
      customerName: customerName || undefined,
      clientHandlingPersonId: clientHandlingPersonId
        ? Number(clientHandlingPersonId)
        : undefined,
      status,
      expectedHours: Number(expectedHours) || 0,
      projectPrice: Number(projectPrice) || 0,
      startDate,
      plannedEndDate: plannedEndDate || undefined,
      actualEndDate: effectiveActualEnd || undefined,
    };
    if (!isEdit) {
      payload.initialMemberEmployeeIds = allEmployees
        .filter((emp) => resourceNames.includes(emp.fullName))
        .map((emp) => emp.id);
    }
    await onSubmit(payload);
  }

  const shownError = localError ?? error ?? null;
  const deptLabel =
    departments.length > 0 ? departments.join(", ") : "all departments";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Header banner */}
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-500/15 sm:p-8">
        <div className="flex items-center gap-4">
          <Link
            href={cancelHref}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-white/20 px-2.5 py-0.5 text-xs font-black text-cyan-50">
                {project?.projectCode ?? "New project"}
              </span>
              <h1 className="text-2xl font-black">
                {isEdit ? "Edit Project" : "New Project Setup"}
              </h1>
            </div>
            <p className="mt-1 text-xs text-cyan-50/80">
              Configure project client, team resources, milestones scope &amp;
              contract budgets
            </p>
          </div>
        </div>
      </div>

      {shownError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {shownError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Card 1: Project identity & customer */}
        <section className="relative focus-within:z-30 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
              <FolderKanban className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Project Details &amp; Client
            </h2>
          </header>
          <div className="flex flex-col gap-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <FormField label="Project *">
                  {(field) => (
                    <Select
                      {...field}
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    >
                      <option value="">Select Project</option>
                      {(categoriesQuery.data?.data ?? []).map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
              <div className="sm:col-span-4">
                <FormField
                  label="Project Code"
                  labelAction={
                    <span className="text-[10px] font-normal text-gray-400">
                      Auto-Generated
                    </span>
                  }
                >
                  {(field) => (
                    <Input
                      {...field}
                      disabled
                      value={
                        project?.projectCode ??
                        "Generated on save (e.g. TXW/PRJ/ME/26-27/001)"
                      }
                      readOnly
                    />
                  )}
                </FormField>
              </div>
              <div className="sm:col-span-5">
                <FormField label="Project Name" required>
                  {(field) => (
                    <Input
                      {...field}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. NextGen Cloud ERP Platform"
                    />
                  )}
                </FormField>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Customer Assignment
              </p>
              <Select
                aria-label="Customer / Company"
                value={customerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCustomerId(id);
                  const acc = accountsQuery.data?.data.find(
                    (a) => String(a.id) === id,
                  );
                  setCustomerName(id ? (acc?.name ?? customerName) : "");
                }}
              >
                <option value="">Select customer / company (optional)</option>
                {(accountsQuery.data?.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name} (ID {a.id})
                  </option>
                ))}
              </Select>
            </div>

            <FormField label="Project Scope Description">
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of requirements, deliverables and goals..."
                />
              )}
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-theme-sm font-medium text-gray-700 dark:text-white/90">
                    Departments (Multi-Select)
                  </span>
                  <span className="text-[10px] font-semibold text-brand-700 dark:text-cyan-300">
                    {departments.length} selected
                  </span>
                </div>
                <div className="min-h-10 rounded-2xl border border-gray-200/80 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
                  <DepartmentMultiSelect
                    value={departments}
                    onChange={setDepartments}
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  Selected departments filter available Client Handling Person
                  &amp; Team Resources below.
                </p>
              </div>
              <FormField
                label="Project Status"
                hint={
                  status === "completed" && !actualEndDate
                    ? "Actual end date will be set to today on save."
                    : undefined
                }
              >
                {(field) => (
                  <Select
                    {...field}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                )}
              </FormField>
            </div>
          </div>
        </section>

        {/* Card 2: Financials, timelines & resources */}
        <section className="relative focus-within:z-30 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
              <IndianRupee className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Budget, Timelines &amp; Team Resources
            </h2>
          </header>
          <div className="flex flex-col gap-5 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Expected Hours">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.5"
                    value={expectedHours}
                    onChange={(e) => setExpectedHours(e.target.value)}
                    placeholder="e.g. 200"
                  />
                )}
              </FormField>
              <FormField label="Project Contract Price (₹)">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectPrice}
                    onChange={(e) => setProjectPrice(e.target.value)}
                    placeholder="e.g. 500000"
                  />
                )}
              </FormField>
            </div>

            <div className="relative focus-within:z-30 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Start Date" required>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Planned End Date">
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Actual End Date">
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={actualEndDate}
                    onChange={(e) => setActualEndDate(e.target.value)}
                  />
                )}
              </FormField>
            </div>

            <FormField
              label="Client Handling Person (Lead Contact)"
              labelAction={
                <span className="text-[10px] font-medium text-gray-400">
                  Filtered by {deptLabel}
                </span>
              }
            >
              {(field) => (
                <Select
                  {...field}
                  value={clientHandlingPersonId}
                  onChange={(e) => setClientHandlingPersonId(e.target.value)}
                >
                  <option value="">
                    {departmentEmployees.length === 0
                      ? `No employees found in ${deptLabel}`
                      : "Select team lead / manager (optional)"}
                  </option>
                  {departmentEmployees.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.fullName} ({emp.team.name})
                    </option>
                  ))}
                  {/* Keep a lead from another department selectable. */}
                  {project?.clientHandlingPerson &&
                  !departmentEmployees.some(
                    (emp) => emp.id === project.clientHandlingPerson?.id,
                  ) ? (
                    <option value={String(project.clientHandlingPerson.id)}>
                      {project.clientHandlingPerson.fullName} (current)
                    </option>
                  ) : null}
                </Select>
              )}
            </FormField>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-theme-sm font-medium text-gray-700 dark:text-white/90">
                  Project Resources (Team Members)
                </span>
                <span className="text-[10px] font-semibold text-brand-700 dark:text-cyan-300">
                  {resourceNames.length} selected ({departmentEmployees.length}{" "}
                  available in {deptLabel})
                </span>
              </div>
              <ProjectResourcesGrid
                employees={departmentEmployees}
                selectedIds={selectedIds}
                onChange={handleResourceIdsChange}
              />
              {resourceNames.some(
                (n) => !departmentEmployees.some((e) => e.fullName === n),
              ) ? (
                <p className="text-[10px] text-gray-400">
                  Also assigned (outside current department filter):{" "}
                  {resourceNames
                    .filter(
                      (n) => !departmentEmployees.some((e) => e.fullName === n),
                    )
                    .join(", ")}
                </p>
              ) : null}
              {isEdit ? (
                <p className="text-[10px] text-gray-400">
                  Resources are the display roster; hours-tracking team members
                  are managed in the Team Members section below.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={cancelHref}
            className="rounded-xl border border-gray-200 px-6 py-2.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
