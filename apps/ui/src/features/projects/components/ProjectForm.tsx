"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  SectionCard,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  useProjectCodeMaster,
  useProjects as useProjectCategories,
} from "@/features/projects-master/hooks";
import { useEmployees } from "@/features/hr/employees/hooks";
import { DepartmentMultiSelect } from "./DepartmentMultiSelect";
import {
  ProjectResourcesGrid,
  filterEmployeesByDepartments,
} from "./ProjectResourcesGrid";
import {
  ProjectSummaryCard,
  type SummaryCheck,
  type SummaryRow,
} from "./ProjectSummaryCard";
import { useProjectCustomers } from "../hooks";
import { formatCurrency, toDateInput, todayInput } from "../format";
import { projectCodePreview } from "../project-code-preview";
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

/** One form for create and edit: a banner header, four sections (Basics,
 * Client, Scope & Team, Budget & Schedule), a sticky live summary (code
 * preview, key figures, what is still missing) and a sticky action bar. */
export function ProjectForm({
  project,
  submitting,
  error,
  cancelHref,
  onSubmit,
}: ProjectFormProps) {
  const isEdit = Boolean(project);
  const router = useRouter();

  const [projectType, setProjectType] = useState(project?.projectType ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [salesCustomerId, setSalesCustomerId] = useState<string>(
    project?.salesCustomerId ? String(project.salesCustomerId) : "",
  );
  const [customerSearch, setCustomerSearch] = useState("");
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
  const customersQuery = useProjectCustomers(customerSearch.trim());
  const customerOptions = useMemo(() => {
    const rows = customersQuery.data ?? [];
    const current = project?.salesCustomer;
    // Keep the saved customer selectable even when the search filters it out
    // (or it has since been deactivated in Sales).
    return current && !rows.some((c) => c.id === current.id)
      ? [current, ...rows]
      : rows;
  }, [customersQuery.data, project?.salesCustomer]);
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
      // The server copies the Sales customer's company name onto the project.
      // `null` only when an existing link is cleared — a legacy project with a
      // free-text customer name and no link must keep that name.
      salesCustomerId: salesCustomerId
        ? Number(salesCustomerId)
        : project?.salesCustomerId
          ? null
          : undefined,
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

  // ---- Live summary (read-only view of the values above) ----
  const codeMasterQuery = useProjectCodeMaster();
  const codePreview =
    project?.projectCode ??
    projectCodePreview(codeMasterQuery.data, projectType, startDate);
  const category = (categoriesQuery.data?.data ?? []).find(
    (c) => c.code === projectType,
  );
  const customerLabel =
    customerOptions.find((c) => String(c.id) === salesCustomerId)
      ?.companyName ??
    project?.customerName ??
    "—";
  const hoursNumber = Number(expectedHours) || 0;
  const priceNumber = Number(projectPrice) || 0;
  const plannedEndError =
    startDate && plannedEndDate && plannedEndDate < startDate
      ? "Planned end date cannot be earlier than the start date."
      : undefined;
  const durationDays =
    startDate && plannedEndDate && !plannedEndError
      ? Math.round(
          (Date.parse(`${plannedEndDate}T00:00:00Z`) -
            Date.parse(`${startDate}T00:00:00Z`)) /
            86_400_000,
        )
      : null;
  const nameOk = name.trim().length >= 2;

  const summaryRows: SummaryRow[] = [
    {
      label: "Category",
      value: category ? `${category.code} — ${category.name}` : "—",
    },
    { label: "Customer", value: customerLabel },
    {
      label: "Departments",
      value: departments.length > 0 ? departments.join(", ") : "—",
    },
    {
      label: "Duration",
      value: durationDays === null ? "—" : `${durationDays} days`,
    },
    {
      label: "Expected hours",
      value: hoursNumber > 0 ? `${hoursNumber}h` : "—",
    },
    {
      label: "Contract price",
      value: priceNumber > 0 ? formatCurrency(priceNumber) : "—",
    },
    {
      label: "Price per hour",
      value:
        hoursNumber > 0 && priceNumber > 0
          ? formatCurrency(priceNumber / hoursNumber)
          : "—",
    },
    { label: "Team members", value: String(resourceNames.length) },
  ];
  const summaryChecks: SummaryCheck[] = [
    { label: "Project name", done: nameOk, required: true },
    { label: "Start date", done: Boolean(startDate), required: true },
    { label: "Project category", done: Boolean(projectType), required: false },
    { label: "Customer", done: Boolean(salesCustomerId), required: false },
    { label: "Departments", done: departments.length > 0, required: false },
    { label: "Expected hours", done: hoursNumber > 0, required: false },
    { label: "Contract price", done: priceNumber > 0, required: false },
    {
      label: "Planned end date",
      done: Boolean(plannedEndDate),
      required: false,
    },
  ];
  const missingRequired = summaryChecks.filter(
    (c) => c.required && !c.done,
  ).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        variant="banner"
        icon={
          <Link
            href={cancelHref}
            aria-label="Back"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm transition-colors hover:bg-brand-50 dark:bg-[#161B26] dark:text-sky-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
        badge={
          <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-theme-xs font-semibold text-white">
            {project?.projectCode ?? "New project"}
          </span>
        }
        title={isEdit ? "Edit Project" : "New Project Setup"}
        description="Configure project client, team resources, milestones scope & contract budgets"
      />

      {shownError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {shownError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {/* 1. Basics */}
            <SectionCard
              title="Basics"
              description="What the project is and how it is numbered"
              className="relative focus-within:z-30"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Project Category"
                  hint={
                    isEdit
                      ? undefined
                      : `The category is part of the code: ${codePreview}`
                  }
                >
                  {(field) => (
                    <Select
                      {...field}
                      aria-label="Project Category"
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {(categoriesQuery.data?.data ?? []).map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
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
              <FormField label="Project Scope Description">
                {(field) => (
                  <Textarea
                    {...field}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of requirements, deliverables and goals..."
                  />
                )}
              </FormField>
              <div className="sm:max-w-xs">
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
                      aria-label="Project Status"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as ProjectStatus)
                      }
                    >
                      <option value="active">Active</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  )}
                </FormField>
              </div>
            </SectionCard>

            {/* 2. Client */}
            <SectionCard
              title="Client"
              description="The Sales customer this project is delivered for"
              className="relative focus-within:z-30"
            >
              <FormField label="Customer / Company">
                {(field) => (
                  <Select
                    {...field}
                    aria-label="Customer / Company"
                    value={salesCustomerId}
                    onChange={(e) => setSalesCustomerId(e.target.value)}
                    onSearchChange={setCustomerSearch}
                    searchPlaceholder="Search customers by name or code"
                  >
                    <option value="">
                      Select customer / company (optional)
                    </option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.companyName} ({c.customerCode})
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              {!salesCustomerId && project?.customerName ? (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Current client: {project.customerName} (not linked to a Sales
                  customer)
                </p>
              ) : null}
            </SectionCard>

            {/* 3. Scope & team */}
            <SectionCard
              title="Scope & Team"
              description="Departments involved, the lead contact and the project team"
              className="relative focus-within:z-30"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-theme-sm font-medium text-gray-700 dark:text-white/90">
                    Departments (Multi-Select)
                  </span>
                  <span className="text-theme-xs font-medium text-brand-700 dark:text-cyan-300">
                    {departments.length} selected
                  </span>
                </div>
                <div className="min-h-10 rounded-2xl border border-gray-200/80 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
                  <DepartmentMultiSelect
                    value={departments}
                    onChange={setDepartments}
                  />
                </div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Selected departments filter the lead contact and team
                  resources below.
                </p>
              </div>

              <FormField
                label="Client Handling Person (Lead Contact)"
                labelAction={
                  <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                    Filtered by {deptLabel}
                  </span>
                }
              >
                {(field) => (
                  <Select
                    {...field}
                    aria-label="Client Handling Person (Lead Contact)"
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
                  <span className="text-theme-xs font-medium text-brand-700 dark:text-cyan-300">
                    {resourceNames.length} selected (
                    {departmentEmployees.length} available in {deptLabel})
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
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Also assigned (outside current department filter):{" "}
                    {resourceNames
                      .filter(
                        (n) =>
                          !departmentEmployees.some((e) => e.fullName === n),
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {isEdit ? (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Resources are the display roster; hours-tracking team
                    members are managed in the Team Members section below.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {/* 4. Budget & schedule */}
            <SectionCard
              title="Budget & Schedule"
              description="Contract value, planned effort and the project timeline"
              className="relative focus-within:z-30"
            >
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

              <div className="relative grid grid-cols-1 gap-4 focus-within:z-30 sm:grid-cols-3">
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
                <FormField
                  label="Planned End Date"
                  error={plannedEndError}
                  hint={
                    durationDays !== null
                      ? `${durationDays} days from the start date`
                      : undefined
                  }
                >
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
            </SectionCard>
          </div>

          <aside
            aria-label="Project summary"
            className="min-w-0 lg:sticky lg:top-24"
          >
            <ProjectSummaryCard
              code={codePreview}
              codeIsFinal={isEdit}
              rows={summaryRows}
              checks={summaryChecks}
            />
          </aside>
        </div>

        {/* Sticky action bar: always in reach, however long the form is. */}
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/90 px-5 py-3 shadow-theme-sm backdrop-blur dark:border-gray-800 dark:bg-gray-dark/90">
          <p className="hidden text-theme-xs text-gray-500 dark:text-gray-400 sm:block">
            {missingRequired === 0
              ? "Required fields are filled."
              : `${missingRequired} required ${missingRequired === 1 ? "field is" : "fields are"} still missing.`}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(cancelHref)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? "Update Project" : "Create Project"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
