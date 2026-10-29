"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Users2 } from "lucide-react";
import {
  Button,
  DeleteConfirmDialog,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useAddProjectMember,
  useProject,
  useRemoveProjectMember,
  useUpdateProject,
} from "@/features/projects/hooks";
import type { Project } from "@/features/projects/types";
import { ProjectForm } from "@/features/projects/components/ProjectForm";
import { errorMessage } from "@/features/projects/format";
import { useEmployees } from "@/features/hr/employees/hooks";

/** Team-member allocation (hours/rate tracking rows) — a new-module
 * addition kept below the legacy-parity edit form. */
function TeamMembersCard({ project }: { project: Project }) {
  const { toast } = useToast();
  const addMemberMutation = useAddProjectMember();
  const removeMemberMutation = useRemoveProjectMember();
  const employeesQuery = useEmployees({ page: 1, limit: 100 });

  const [showAddMember, setShowAddMember] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newRole, setNewRole] = useState("Developer");
  const [newHourlyRate, setNewHourlyRate] = useState("50");
  const [newEstimatedHours, setNewEstimatedHours] = useState("40");
  const [pendingRemove, setPendingRemove] = useState<{
    employeeId: number;
    name: string;
  } | null>(null);

  const existing = new Set((project.members ?? []).map((m) => m.employeeId));
  const options = (employeesQuery.data?.data ?? []).filter(
    (e) => !existing.has(e.id),
  );

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmployeeId) {
      toast({ title: "Please select an employee", variant: "warning" });
      return;
    }
    try {
      await addMemberMutation.mutateAsync({
        projectId: project.id,
        input: {
          employeeId: Number(newEmployeeId),
          role: newRole.trim() || "Contributor",
          hourlyRate: Number(newHourlyRate) || 0,
          estimatedHours: Number(newEstimatedHours) || 0,
        },
      });
      toast({ title: "Team member assigned", variant: "success" });
      setShowAddMember(false);
      setNewEmployeeId("");
    } catch (err) {
      toast({
        title: "Failed to add member",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    try {
      await removeMemberMutation.mutateAsync({
        projectId: project.id,
        employeeId: pendingRemove.employeeId,
      });
      toast({ title: "Team member removed", variant: "success" });
      setPendingRemove(null);
    } catch (err) {
      toast({
        title: "Failed to remove member",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-brand-600 dark:text-cyan-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Assigned Team Members ({project.members?.length || 0})
          </h2>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowAddMember((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Member
        </Button>
      </div>

      {showAddMember ? (
        <form
          onSubmit={handleAddMember}
          className="mb-6 rounded-xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-900/30 dark:bg-sky-950/20"
        >
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300">
            Assign New Team Member
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <FormField label="Employee" required>
              {(field) => (
                <Select
                  {...field}
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {options.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Project Role">
              {(field) => (
                <Input
                  {...field}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Lead, Designer..."
                />
              )}
            </FormField>
            <FormField label="Hourly Rate (₹/h)">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Est. Hours">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min="0"
                  value={newEstimatedHours}
                  onChange={(e) => setNewEstimatedHours(e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowAddMember(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={addMemberMutation.isPending}
            >
              Assign
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="pb-3 font-semibold">Employee</th>
              <th className="pb-3 font-semibold">Role</th>
              <th className="pb-3 font-semibold">Hourly Rate</th>
              <th className="pb-3 font-semibold">Allocated Hours</th>
              <th className="pb-3 font-semibold">Logged Hours</th>
              <th className="pb-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {project.members && project.members.length > 0 ? (
              project.members.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                >
                  <td className="py-3 font-medium text-gray-900 dark:text-white">
                    {m.employee?.fullName || `Employee #${m.employeeId}`}
                    <div className="text-[11px] text-gray-400">
                      {m.employee?.employeeCode}
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-300">
                    {m.role}
                  </td>
                  <td className="py-3 text-gray-700 dark:text-gray-300">
                    ₹{Number(m.hourlyRate).toFixed(2)}/h
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-300">
                    {Number(m.estimatedHours)}h
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-300">
                    {Number(m.loggedHours)}h
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingRemove({
                          employeeId: m.employeeId,
                          name:
                            m.employee?.fullName ?? `Employee #${m.employeeId}`,
                        })
                      }
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      aria-label={`Remove ${m.employee?.fullName ?? "member"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-gray-400 dark:text-gray-500"
                >
                  No team members allocated to this project yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        title="Remove team member"
        itemName={pendingRemove?.name ?? ""}
        loading={removeMemberMutation.isPending}
      />
    </div>
  );
}

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  const router = useRouter();
  const { toast } = useToast();
  const projectQuery = useProject(projectId);
  const updateMutation = useUpdateProject();
  const [error, setError] = useState<string | null>(null);

  if (projectQuery.isPending) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const project = projectQuery.data;
  if (projectQuery.isError || !project) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <ErrorState
          title="Failed to load project details or project not found."
          onRetry={() => projectQuery.refetch()}
        />
        <Link
          href="/projects/list"
          className="text-xs font-bold text-brand-600 hover:underline dark:text-cyan-400"
        >
          Return to Projects List
        </Link>
      </div>
    );
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: projectId, input: payload });
      toast({ title: "Project updated successfully", variant: "success" });
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to update project"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectForm
        key={project.id}
        project={project}
        submitting={updateMutation.isPending}
        error={error}
        cancelHref={`/projects/${projectId}`}
        onSubmit={handleSubmit}
      />
      <TeamMembersCard project={project} />
    </div>
  );
}
