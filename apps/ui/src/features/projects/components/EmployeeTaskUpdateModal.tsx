"use client";

import { useState } from "react";
import { Bell, Edit3 } from "lucide-react";
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
import { useProject, useProjectTasks, useUpdateTask } from "../hooks";
import { errorMessage } from "../format";
import type { ProjectTask, TaskStatus } from "../types";

type DependencyKind = "none" | "employee" | "client" | "task";

const DEPENDENCY_KINDS: { id: DependencyKind; label: string; desc: string }[] =
  [
    { id: "none", label: "None", desc: "Independent" },
    { id: "employee", label: "Employee", desc: "Colleague" },
    { id: "client", label: "Client (Others)", desc: "Client Lead" },
    { id: "task", label: "Prereq Task", desc: "Deliverable" },
  ];

function inferKind(task: ProjectTask): DependencyKind {
  const t = (task.dependencyType ?? "").toLowerCase();
  if (t === "employee" || t === "client" || t === "task") return t;
  if (task.dependencyTaskId) return "task";
  return "none";
}

export interface EmployeeTaskUpdateModalProps {
  open: boolean;
  onClose: () => void;
  task: ProjectTask | null;
  /** Fired when this save transitions the task to completed. */
  onFinished?: (task: ProjectTask) => void;
}

/** Legacy `components/EmployeeTaskUpdateModal.tsx` — the assignee's own
 * "update progress" dialog: status, completion %, and dependency tagging
 * (employee / client / prerequisite task + requirement text). Saves through
 * `PATCH /projects/tasks/:taskId`, which awards points on completion. */
export function EmployeeTaskUpdateModal({
  open,
  onClose,
  task,
  onFinished,
}: EmployeeTaskUpdateModalProps) {
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const projectId = open && task ? task.projectId : undefined;
  const projectQuery = useProject(projectId);
  const siblingTasksQuery = useProjectTasks(projectId);
  const employeesQuery = useEmployees({ page: 1, limit: 100 });

  // State is seeded from `task` on mount — callers key this component by the
  // task id so each opened task gets a fresh form (no setState-in-effect).
  const initialKind = task ? inferKind(task) : "none";
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? "not_started",
  );
  const [completionPercent, setCompletionPercent] = useState(
    task
      ? (task.completionPercent ?? (task.status === "completed" ? 100 : 0))
      : 0,
  );
  const [depKind, setDepKind] = useState<DependencyKind>(initialKind);
  const [depTarget, setDepTarget] = useState(
    initialKind === "task"
      ? String(task?.dependencyTaskId ?? "")
      : initialKind === "employee"
        ? String(task?.dependencyTargetId ?? "")
        : "",
  );
  const [depRequirement, setDepRequirement] = useState(
    task?.dependencyRequirement ?? "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const project = projectQuery.data;
  const clientName =
    project?.customerName || project?.customer?.name || "Project Client";
  const clientLead = project?.clientHandlingPerson?.fullName ?? "";
  const employees = employeesQuery.data?.data ?? [];
  const siblingTasks = (siblingTasksQuery.data ?? []).filter(
    (t) => t.id !== task?.id,
  );

  function handleStatusChange(next: TaskStatus) {
    setStatus(next);
    if (next === "completed") setCompletionPercent(100);
    else if (next === "not_started") setCompletionPercent(0);
    else if (next === "in_progress" && completionPercent === 0)
      setCompletionPercent(25);
  }

  function handleKindChange(kind: DependencyKind) {
    setDepKind(kind);
    setDepTarget("");
    if (kind === "none") setDepRequirement("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setFormError(null);

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
      const dep = siblingTasks.find((t) => t.id === Number(depTarget));
      dependencyTaskId = Number(depTarget);
      dependencyTargetName = dep ? `${dep.taskCode} ${dep.title}` : null;
    } else if (depKind === "employee") {
      const emp = employees.find((x) => x.id === Number(depTarget));
      dependencyTargetId = Number(depTarget);
      dependencyTargetName = emp?.fullName ?? null;
    } else if (depKind === "client") {
      dependencyTargetId = project?.customerId ?? null;
      dependencyTargetName = clientName;
    }

    const effectivePercent =
      status === "completed"
        ? 100
        : Math.min(100, Math.max(0, Number(completionPercent) || 0));
    const willComplete = status === "completed" && task.status !== "completed";

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        input: {
          status,
          completionPercent: effectivePercent,
          dependencyType: depKind === "none" ? null : depKind,
          dependencyRequirement:
            depKind === "none" ? null : depRequirement.trim(),
          dependencyTaskId,
          dependencyTargetId,
          dependencyTargetName,
        },
      });
      if (willComplete) {
        toast({
          title: `Task marked completed! +${task.points} points awarded`,
          variant: "success",
        });
        onFinished?.({ ...task, status, completionPercent: effectivePercent });
      } else {
        toast({
          title: "Task progress updated successfully",
          variant: "success",
        });
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to update task progress"));
    }
  }

  return (
    <Dialog
      open={open && Boolean(task)}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
            <Edit3 className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold text-gray-900 dark:text-white">
              Update Task Progress &amp; Dependencies
            </span>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Update work status, completion % &amp; tag employee / client
              dependencies
            </span>
          </span>
        </span>
      }
    >
      {task ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-cyan-300">
                {task.taskCode}
              </span>
              <span className="text-[10px] font-bold text-gray-400">
                {task.project?.projectCode ?? `Project #${task.projectId}`} •{" "}
                {Number(task.hoursToComplete || 0)}h est
              </span>
            </div>
            <p className="line-clamp-2 pt-1 text-xs font-bold text-gray-800 dark:text-gray-200">
              {task.title}
            </p>
          </div>

          <FormField label="Task Status" required>
            {(field) => (
              <Select
                {...field}
                value={status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as TaskStatus)
                }
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="hold">On Hold</option>
                <option value="completed">Completed (100%)</option>
              </Select>
            )}
          </FormField>

          <FormField
            label="Completion Percentage"
            labelAction={
              <span className="text-xs font-black text-brand-700 dark:text-cyan-300">
                {status === "completed" ? 100 : completionPercent}%
              </span>
            }
          >
            {(field) => (
              <div className="flex flex-col gap-2">
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
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  aria-label="Completion percentage slider"
                  disabled={status === "completed"}
                  value={status === "completed" ? 100 : completionPercent}
                  onChange={(e) => setCompletionPercent(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-brand-600"
                />
              </div>
            )}
          </FormField>

          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Dependency Category
              </p>
              {depKind === "client" && clientLead ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                  <Bell className="h-3 w-3" /> Lead: {clientLead}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEPENDENCY_KINDS.map((dk) => (
                <button
                  key={dk.id}
                  type="button"
                  aria-pressed={depKind === dk.id}
                  onClick={() => handleKindChange(dk.id)}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${
                    depKind === dk.id
                      ? "border-brand-500 bg-sky-50 font-bold text-brand-800 dark:border-cyan-500 dark:bg-sky-950/40 dark:text-cyan-200"
                      : "border-gray-200 bg-white font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="block text-xs leading-tight">
                    {dk.label}
                  </span>
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
                    {employees.map((emp) => (
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
                    {siblingTasks.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.taskCode} — {t.title}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : null}

            {depKind !== "none" ? (
              <FormField
                label="Requirement Details / Input Description"
                required
              >
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

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updateTask.isPending}>
              Save Updates
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}
