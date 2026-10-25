"use client";

import { useMemo, useState } from "react";
import { Award, CheckSquare } from "lucide-react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useEmployees } from "@/features/hr/employees/hooks";
import { useCreateTask, usePointsConfig, useUpdateTask } from "../hooks";
import { errorMessage, formatDate, toDateInput, todayInput } from "../format";
import type { Project, ProjectTask, TaskPriority, TaskStatus } from "../types";

type DependencyKind = "none" | "employee" | "client" | "task";

const DEPENDENCY_KINDS: { id: DependencyKind; label: string; desc: string }[] =
  [
    { id: "none", label: "None", desc: "Independent" },
    { id: "employee", label: "Employee", desc: "All Staff" },
    { id: "client", label: "Client (Others)", desc: "Client Lead" },
    { id: "task", label: "Prereq Task", desc: "Deliverable" },
  ];

const DEFAULT_POINTS: Record<TaskPriority, number> = {
  low: 5,
  medium: 10,
  high: 20,
  urgent: 30,
};

/** Mon–Fri × 8h between two calendar days, inclusive — mirrors the backend's
 * `calculateBusinessHours` so the "Auto" hours preview matches what the API
 * will store when no override is sent. */
function businessHours(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let days = 0;
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days * 8;
}

function inferDependencyKind(task: ProjectTask): DependencyKind {
  const t = (task.dependencyType ?? "").toLowerCase();
  if (t === "employee" || t === "client" || t === "task") return t;
  if (task.dependencyTaskId) return "task";
  return "none";
}

export interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** Pre-selects a milestone when adding a task from a milestone row. */
  initialMilestoneId?: number | null;
  taskToEdit?: ProjectTask | null;
}

/** Legacy `components/TaskModal.tsx` — create/edit a task with milestone,
 * assignee, auto business-hours, priority-driven reward points and the
 * four-way dependency category (none / employee / client / prerequisite
 * task). Rendered with ui-kit primitives against the real task DTO. */
export function TaskModal(props: TaskModalProps) {
  const { open, onClose, taskToEdit } = props;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
            <CheckSquare className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-gray-900 dark:text-white">
              {taskToEdit ? "Edit Task" : "Create New Task"}
            </span>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Assign deliverables, calculate business hours &amp; configure
              reward points
            </span>
          </span>
        </span>
      }
    >
      {/* Mounted only while open so each opening seeds fresh form state. */}
      {open ? <TaskForm {...props} /> : null}
    </Dialog>
  );
}

function TaskForm({
  onClose,
  project,
  initialMilestoneId,
  taskToEdit,
}: TaskModalProps) {
  const { toast } = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const pointsConfig = usePointsConfig();
  const employeesQuery = useEmployees({ page: 1, limit: 100 });

  const edit = taskToEdit ?? null;
  const initialKind = edit ? inferDependencyKind(edit) : "none";

  const [title, setTitle] = useState(edit?.title ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [milestoneId, setMilestoneId] = useState<string>(() => {
    const id = edit ? edit.milestoneId : initialMilestoneId;
    return id ? String(id) : "";
  });
  const [assignedToId, setAssignedToId] = useState<string>(
    edit?.assignedToId ? String(edit.assignedToId) : "",
  );
  const [department, setDepartment] = useState(
    edit ? (edit.department ?? "") : (project.departments?.[0] ?? ""),
  );
  const [startDate, setStartDate] = useState(
    edit ? toDateInput(edit.startDate) : todayInput(),
  );
  const [endDate, setEndDate] = useState(
    edit ? toDateInput(edit.endDate) : todayInput(),
  );
  // Only treat stored hours as a manual override when they differ from the
  // auto business-hours value for the stored dates.
  const [hoursOverride, setHoursOverride] = useState<string>(() => {
    if (!edit) return "";
    const stored = Number(edit.hoursToComplete) || 0;
    const auto = businessHours(
      toDateInput(edit.startDate),
      toDateInput(edit.endDate),
    );
    return stored !== auto ? String(stored) : "";
  });
  const [priority, setPriority] = useState<TaskPriority>(
    edit?.priority ?? "medium",
  );
  // `null` = follow the Points Master default for the selected priority.
  const [pointsOverride, setPointsOverride] = useState<number | null>(
    edit ? edit.points : null,
  );
  const [status, setStatus] = useState<TaskStatus>(
    edit?.status ?? "not_started",
  );
  const [completionPercent, setCompletionPercent] = useState(
    edit?.completionPercent ?? 0,
  );
  const [depKind, setDepKind] = useState<DependencyKind>(initialKind);
  const [depTarget, setDepTarget] = useState<string>(() => {
    if (!edit) return "";
    if (initialKind === "task") return String(edit.dependencyTaskId ?? "");
    if (initialKind === "employee")
      return String(edit.dependencyTargetId ?? "");
    return "";
  });
  const [depRequirement, setDepRequirement] = useState(
    edit?.dependencyRequirement ?? "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const configPoints = useMemo(() => {
    const cfg = pointsConfig.data;
    return cfg
      ? { low: cfg.low, medium: cfg.medium, high: cfg.high, urgent: cfg.urgent }
      : DEFAULT_POINTS;
  }, [pointsConfig.data]);
  const points = pointsOverride ?? configPoints[priority];

  // Assignee options: project members (+ client handling lead), like legacy
  // which restricted the picker to the project's resources/members/lead.
  // Falls back to the full employee directory when the project has no team.
  const assigneeOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string }>();
    for (const m of project.members ?? []) {
      map.set(m.employee.id, {
        id: m.employee.id,
        name: m.employee.fullName,
        code: m.employee.employeeCode,
      });
    }
    if (project.clientHandlingPerson) {
      const p = project.clientHandlingPerson;
      map.set(p.id, { id: p.id, name: p.fullName, code: p.employeeCode });
    }
    if (map.size === 0) {
      for (const e of employeesQuery.data?.data ?? []) {
        map.set(e.id, { id: e.id, name: e.fullName, code: e.employeeCode });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [project.members, project.clientHandlingPerson, employeesQuery.data]);

  const allEmployees = employeesQuery.data?.data ?? [];
  const dependencyTasks = (project.tasks ?? []).filter(
    (t) => !taskToEdit || t.id !== taskToEdit.id,
  );
  const clientName =
    project.customerName || project.customer?.name || "Project Client";
  const clientLead = project.clientHandlingPerson?.fullName ?? "";
  const autoHours = businessHours(startDate, endDate);

  function handlePriorityChange(next: TaskPriority) {
    // Legacy re-defaults reward points from the master on priority change.
    setPriority(next);
    setPointsOverride(null);
  }

  function handleDepKindChange(kind: DependencyKind) {
    setDepKind(kind);
    setDepTarget("");
    if (kind === "none") setDepRequirement("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (title.trim().length < 2) {
      setFormError("Task title is required (at least 2 characters).");
      return;
    }
    if (!startDate || !endDate) {
      setFormError("Please enter start and end dates.");
      return;
    }
    if (endDate < startDate) {
      setFormError("Planned end date cannot be earlier than the start date.");
      return;
    }
    if ((depKind === "task" || depKind === "employee") && !depTarget) {
      setFormError("Please select the specific dependency target.");
      return;
    }
    if (depKind !== "none" && !depRequirement.trim()) {
      setFormError(
        "Please enter the requirement / detail needed for this dependency.",
      );
      return;
    }

    let dependencyTaskId: number | null = null;
    let dependencyTargetId: number | null = null;
    let dependencyTargetName: string | null = null;
    if (depKind === "task") {
      const dep = dependencyTasks.find((t) => t.id === Number(depTarget));
      dependencyTaskId = Number(depTarget);
      dependencyTargetName = dep ? `${dep.taskCode} ${dep.title}` : null;
    } else if (depKind === "employee") {
      const emp = allEmployees.find((x) => x.id === Number(depTarget));
      dependencyTargetId = Number(depTarget);
      dependencyTargetName = emp?.fullName ?? null;
    } else if (depKind === "client") {
      dependencyTargetId = project.customerId ?? null;
      dependencyTargetName = clientName;
    }

    const base: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      department: department.trim() || undefined,
      startDate,
      endDate,
      priority,
      points: Number(points) || 0,
      ...(hoursOverride !== ""
        ? { hoursToComplete: Number(hoursOverride) || 0 }
        : {}),
    };

    try {
      if (taskToEdit) {
        await updateTask.mutateAsync({
          taskId: taskToEdit.id,
          input: {
            ...base,
            milestoneId: milestoneId ? Number(milestoneId) : null,
            assignedToId: assignedToId ? Number(assignedToId) : null,
            status,
            completionPercent:
              status === "completed" ? 100 : Number(completionPercent) || 0,
            dependencyType: depKind === "none" ? null : depKind,
            dependencyRequirement:
              depKind === "none" ? null : depRequirement.trim(),
            dependencyTaskId,
            dependencyTargetId,
            dependencyTargetName,
          },
        });
        toast({ title: "Task updated successfully", variant: "success" });
      } else {
        await createTask.mutateAsync({
          projectId: project.id,
          input: {
            ...base,
            ...(milestoneId ? { milestoneId: Number(milestoneId) } : {}),
            ...(assignedToId ? { assignedToId: Number(assignedToId) } : {}),
            ...(depKind !== "none"
              ? {
                  dependencyType: depKind,
                  dependencyRequirement: depRequirement.trim(),
                  ...(dependencyTaskId ? { dependencyTaskId } : {}),
                  ...(dependencyTargetId ? { dependencyTargetId } : {}),
                  ...(dependencyTargetName ? { dependencyTargetName } : {}),
                }
              : {}),
          },
        });
        toast({ title: "New task created successfully", variant: "success" });
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to save task"));
    }
  }

  const saving = createTask.isPending || updateTask.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {formError}
        </p>
      ) : null}

      {/* Project association */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Project Association
          </p>
          <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
            {taskToEdit
              ? `Task ID: ${taskToEdit.taskCode}`
              : "Task ID: auto-generated on save"}
          </span>
        </div>
        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
          {project.projectCode} — {project.name}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Department">
            {(field) => (
              <Select
                {...field}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">General</option>
                {(project.departments ?? []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Target Milestone">
            {(field) => (
              <Select
                {...field}
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
              >
                <option value="">General / No Milestone</option>
                {(project.milestones ?? []).map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.title} ({formatDate(m.targetDate)})
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
      </div>

      <FormField label="Task Title" required>
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Firmware sensor polling loop"
          />
        )}
      </FormField>

      <FormField label="Task Description">
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of task deliverable, requirements & acceptance criteria..."
          />
        )}
      </FormField>

      <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
        <FormField
          label="Assignee"
          hint={
            (project.members?.length ?? 0) > 0
              ? "Limited to this project's team members and client lead."
              : "Project has no team members yet — showing the employee directory."
          }
        >
          {(field) => (
            <Select
              {...field}
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name} ({a.code})
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <FormField label="Planned End Date" required>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Hours to Complete"
          hint={
            hoursOverride === ""
              ? `Auto: ${autoHours}h (${Math.round(autoHours / 8)} business days)`
              : `Manual override (auto would be ${autoHours}h)`
          }
          labelAction={
            hoursOverride !== "" ? (
              <button
                type="button"
                onClick={() => setHoursOverride("")}
                className="text-[10px] font-bold text-brand-600 hover:underline dark:text-cyan-400"
              >
                Reset to auto
              </button>
            ) : (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-700 dark:bg-sky-950/40 dark:text-cyan-300">
                Auto
              </span>
            )
          }
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              min="0"
              step="0.5"
              value={hoursOverride === "" ? String(autoHours) : hoursOverride}
              onChange={(e) => setHoursOverride(e.target.value)}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Priority">
          {(field) => (
            <Select
              {...field}
              value={priority}
              onChange={(e) =>
                handlePriorityChange(e.target.value as TaskPriority)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          )}
        </FormField>
        <FormField
          label="Reward Points"
          labelAction={<Award className="h-3.5 w-3.5 text-amber-500" />}
          hint="Defaults from the Points Master for the selected priority."
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              min="0"
              value={points}
              onChange={(e) =>
                setPointsOverride(Math.max(0, Number(e.target.value) || 0))
              }
            />
          )}
        </FormField>
      </div>

      {/* Dependency configuration */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Dependency Category
          </p>
          {depKind === "client" && clientLead ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              Lead: {clientLead}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEPENDENCY_KINDS.map((dk) => (
            <button
              key={dk.id}
              type="button"
              onClick={() => handleDepKindChange(dk.id)}
              aria-pressed={depKind === dk.id}
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                depKind === dk.id
                  ? "border-brand-500 bg-sky-50 font-bold text-brand-800 dark:border-cyan-500 dark:bg-sky-950/40 dark:text-cyan-200"
                  : "border-gray-200 bg-white font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span className="block text-xs leading-tight">{dk.label}</span>
              <span className="mt-0.5 block text-[10px] text-gray-400">
                {dk.desc}
              </span>
            </button>
          ))}
        </div>

        {depKind === "employee" ? (
          <FormField label="Select Employee Dependency" required>
            {(field) => (
              <Select
                {...field}
                value={depTarget}
                onChange={(e) => setDepTarget(e.target.value)}
              >
                <option value="">Select employee</option>
                {allEmployees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.fullName} ({emp.team.name})
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}

        {depKind === "client" ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Client Tagged
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-bold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {clientName}
              {clientLead ? ` (Handled by: ${clientLead})` : ""}
            </p>
          </div>
        ) : null}

        {depKind === "task" ? (
          <FormField label="Select Prerequisite Deliverable" required>
            {(field) => (
              <Select
                {...field}
                value={depTarget}
                onChange={(e) => setDepTarget(e.target.value)}
              >
                <option value="">Select task</option>
                {dependencyTasks.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.taskCode} — {t.title}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        ) : null}

        {depKind !== "none" ? (
          <FormField label="Requirement Details / Input Description" required>
            {(field) => (
              <Textarea
                {...field}
                rows={2}
                value={depRequirement}
                onChange={(e) => setDepRequirement(e.target.value)}
                placeholder="Specify the exact deliverables, inputs, approvals, or files needed from this dependency..."
              />
            )}
          </FormField>
        ) : null}
      </div>

      {/* Status & progress — edit only, like legacy */}
      {taskToEdit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Status">
            {(field) => (
              <Select
                {...field}
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="hold">On Hold</option>
                <option value="completed">Completed</option>
              </Select>
            )}
          </FormField>
          <FormField
            label={`Completion % (${status === "completed" ? 100 : completionPercent}%)`}
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                min="0"
                max="100"
                disabled={status === "completed"}
                value={status === "completed" ? 100 : completionPercent}
                onChange={(e) =>
                  setCompletionPercent(
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
              />
            )}
          </FormField>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {taskToEdit ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
