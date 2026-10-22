"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Users2 } from "lucide-react";
import {
  useAddProjectMember,
  useProject,
  useRemoveProjectMember,
  useUpdateProject,
} from "@/features/projects/hooks";
import type { Project } from "@/features/projects/types";

function EditProjectForm({
  project,
  projectId,
}: {
  project: Project;
  projectId: number;
}) {
  const router = useRouter();
  const updateMutation = useUpdateProject();
  const addMemberMutation = useAddProjectMember();
  const removeMemberMutation = useRemoveProjectMember();

  const [name, setName] = useState(project.name || "");
  const [department, setDepartment] = useState(
    project.department || "Engineering",
  );
  const [customerName, setCustomerName] = useState(project.customerName || "");
  const [status, setStatus] = useState<
    "active" | "on_hold" | "completed" | "cancelled"
  >(project.status || "active");
  const [projectPrice, setProjectPrice] = useState<number>(
    Number(project.projectPrice) || 0,
  );
  const [expectedHours, setExpectedHours] = useState<number>(
    Number(project.expectedHours) || 0,
  );
  const [startDate, setStartDate] = useState(
    project.startDate ? project.startDate.slice(0, 10) : "",
  );
  const [plannedEndDate, setPlannedEndDate] = useState(
    project.plannedEndDate ? project.plannedEndDate.slice(0, 10) : "",
  );
  const [description, setDescription] = useState(project.description || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New member inputs
  const [showAddMember, setShowAddMember] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState<number>(1);
  const [newRole, setNewRole] = useState("Developer");
  const [newHourlyRate, setNewHourlyRate] = useState<number>(50);
  const [newEstimatedHours, setNewEstimatedHours] = useState<number>(40);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: projectId,
        input: {
          name,
          department: department || undefined,
          customerName: customerName || undefined,
          status,
          projectPrice: Number(projectPrice) || 0,
          expectedHours: Number(expectedHours) || 0,
          startDate: startDate || undefined,
          plannedEndDate: plannedEndDate || undefined,
          description: description || undefined,
        },
      });

      setSuccess("Project successfully updated!");
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 700);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update project");
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMemberMutation.mutateAsync({
        projectId,
        input: {
          employeeId: Number(newEmployeeId),
          role: newRole,
          hourlyRate: Number(newHourlyRate) || 0,
          estimatedHours: Number(newEstimatedHours) || 0,
        },
      });
      setShowAddMember(false);
      setNewEmployeeId(1);
      setNewRole("Developer");
      setNewHourlyRate(50);
      setNewEstimatedHours(40);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to add member");
      }
    }
  };

  const handleRemoveMember = async (employeeId: number) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await removeMemberMutation.mutateAsync({
        projectId,
        employeeId,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to remove member");
      }
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-cyan-400">
                {project.projectCode}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs capitalize text-gray-500 dark:text-gray-400">
                {project.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Edit Project Settings
            </h1>
          </div>
        </div>

        <Link
          href={`/projects/${projectId}`}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          View Overview
        </Link>
      </div>

      {/* Main Settings Form Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Project Status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as
                      "active" | "on_hold" | "completed" | "cancelled",
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Client / Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Contract Price ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={projectPrice}
                onChange={(e) => setProjectPrice(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Expected Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={expectedHours}
                onChange={(e) => setExpectedHours(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Planned End Date
              </label>
              <input
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Project Description & Scope
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Link
              href={`/projects/${projectId}`}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Project Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Team Members Allocation Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Assigned Team Members ({project.members?.length || 0})
            </h2>
          </div>
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-cyan-300 dark:hover:bg-blue-900/50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Member
          </button>
        </div>

        {showAddMember && (
          <form
            onSubmit={handleAddMember}
            className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20"
          >
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-cyan-300">
              Assign New Team Member
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Employee ID
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Project Role
                </label>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Lead, Designer..."
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Hourly Rate ($/h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Est. Hours
                </label>
                <input
                  type="number"
                  min="0"
                  value={newEstimatedHours}
                  onChange={(e) => setNewEstimatedHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMemberMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {addMemberMutation.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>
        )}

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
                    <td className="py-3 font-mono text-gray-700 dark:text-gray-300">
                      ${Number(m.hourlyRate).toFixed(2)}/h
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {Number(m.estimatedHours)}h
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {Number(m.loggedHours)}h
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleRemoveMember(m.employeeId)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        title="Remove member"
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
      </div>
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
  const { data: project, isLoading, error: fetchError } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
      </div>
    );
  }

  if (fetchError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          Failed to load project details or project not found.
        </p>
        <Link
          href="/projects/list"
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
        >
          Return to Projects List
        </Link>
      </div>
    );
  }

  return (
    <EditProjectForm key={project.id} project={project} projectId={projectId} />
  );
}
