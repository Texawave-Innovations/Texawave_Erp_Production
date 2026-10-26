"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  FolderKanban,
  Milestone as MilestoneIcon,
  Plus,
  Receipt,
  Trash2,
  Users2,
  Play,
  Square,
  AlertCircle,
} from "lucide-react";
import {
  useProject,
  useCreateMilestone,
  useCreateTask,
  useUpdateTask,
  useAddProjectMember,
  useRemoveProjectMember,
  useCreateExpense,
  useStartTimer,
  useStopTimer,
  useActiveTimer,
} from "@/features/projects/hooks";
import {
  HealthBadge,
  PriorityBadge,
  StatusBadge,
} from "@/features/projects/components/HealthBadge";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const { data: project, isLoading } = useProject(projectId);
  const { data: activeTimer } = useActiveTimer();

  const [activeTab, setActiveTab] = useState<
    "overview" | "milestones" | "tasks" | "members" | "expenses"
  >("overview");

  // Dialog state
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Form states
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<string>("medium");
  const [taskStartDate, setTaskStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [taskEndDate, setTaskEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [taskDepId, setTaskDepId] = useState<string>("");
  const [taskError, setTaskError] = useState<string | null>(null);

  const [memberEmployeeId, setMemberEmployeeId] = useState<number>(1);
  const [memberRole, setMemberRole] = useState("Contributor");
  const [memberRate, setMemberRate] = useState<number>(50);

  const [expenseAmount, setExpenseAmount] = useState<number>(500);
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseRef, setExpenseRef] = useState("");

  // Mutations
  const createMilestoneMutation = useCreateMilestone();
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const addMemberMutation = useAddProjectMember();
  const removeMemberMutation = useRemoveProjectMember();
  const createExpenseMutation = useCreateExpense();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Loading project details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          Project not found
        </p>
        <Link
          href="/projects/list"
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          Return to projects list
        </Link>
      </div>
    );
  }

  // Handle milestone creation
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle || !milestoneDate) return;
    await createMilestoneMutation.mutateAsync({
      projectId,
      input: {
        title: milestoneTitle,
        targetDate: milestoneDate,
        order: (project.milestones?.length ?? 0) + 1,
      },
    });
    setMilestoneTitle("");
    setMilestoneDate("");
    setShowMilestoneModal(false);
  };

  // Handle task creation
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    try {
      await createTaskMutation.mutateAsync({
        projectId,
        input: {
          title: taskTitle,
          priority: taskPriority,
          startDate: taskStartDate,
          endDate: taskEndDate,
          dependencyTaskId: taskDepId ? Number(taskDepId) : undefined,
        },
      });
      setTaskTitle("");
      setTaskDepId("");
      setShowTaskModal(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setTaskError(err.message);
      } else {
        setTaskError("Failed to create task");
      }
    }
  };

  // Handle member addition
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMemberMutation.mutateAsync({
      projectId,
      input: {
        employeeId: Number(memberEmployeeId),
        role: memberRole,
        hourlyRate: Number(memberRate),
      },
    });
    setShowMemberModal(false);
  };

  // Handle expense creation
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await createExpenseMutation.mutateAsync({
      projectId,
      input: {
        amount: Number(expenseAmount),
        expenseDate,
        vendor: expenseVendor || undefined,
        referenceNo: expenseRef || undefined,
      },
    });
    setShowExpenseModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <Link
            href="/projects/list"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-cyan-400">
                {project.projectCode}
              </span>
              <StatusBadge status={project.status} />
              <HealthBadge health={project.health} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
              {project.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/edit/${project.id}`}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[
          { id: "overview", label: "Overview", icon: FolderKanban },
          {
            id: "milestones",
            label: `Milestones (${project.milestones?.length ?? 0})`,
            icon: MilestoneIcon,
          },
          {
            id: "tasks",
            label: `Tasks (${project.tasks?.length ?? 0})`,
            icon: CheckCircle2,
          },
          {
            id: "members",
            label: `Team Members (${project.members?.length ?? 0})`,
            icon: Users2,
          },
          { id: "expenses", label: "Expenses & Budget", icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-colors ${
                isSelected
                  ? "border-blue-600 text-blue-600 dark:border-cyan-400 dark:text-cyan-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Project Information
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {project.description || "No description provided."}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3 dark:border-gray-800">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Department
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {project.department || "General"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Client / Customer
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {project.customerName || "Internal"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Start Date
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Planned End Date
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {project.plannedEndDate
                      ? new Date(project.plannedEndDate).toLocaleDateString()
                      : "Ongoing"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Expected Hours
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {Number(project.expectedHours)}h
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase text-gray-400">
                    Logged Hours
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {project.totalLoggedHours ?? 0}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Sidebar */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Financial & Delivery Health
              </h3>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Contract Price:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(project.projectPrice))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Actual Spend:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(project.actualCost))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Earned Revenue:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                    {formatCurrency(project.earnedAmount ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2 dark:border-gray-800">
                  <span className="text-gray-500">Budget Variance:</span>
                  <span
                    className={`font-mono font-bold ${(project.budgetVariance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {formatCurrency(project.budgetVariance ?? 0)}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-500">Delivery Progress</span>
                  <span className="text-gray-900 dark:text-white">
                    {project.progressPercent ?? 0}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                    style={{
                      width: `${Math.min(100, project.progressPercent ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Milestones */}
      {activeTab === "milestones" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Project Milestones
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Chronological stage gates defining project completion.
              </p>
            </div>
            <button
              onClick={() => setShowMilestoneModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Milestone
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {project.milestones?.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">
                No milestones yet. Create your first milestone.
              </p>
            ) : (
              project.milestones?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 font-mono text-xs font-bold text-blue-600 dark:bg-blue-950 dark:text-cyan-400">
                      {m.order}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        {m.title}
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Target Date:{" "}
                        {new Date(m.targetDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Tasks */}
      {activeTab === "tasks" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Work Breakdown Tasks
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sequential task codes (TSK-XXXXXX), dependency tracking, and
                gamification points.
              </p>
            </div>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs font-semibold uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-3 pr-4">Task Code & Title</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Points</th>
                  <th className="py-3 pl-4 text-right">Stopwatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {project.tasks?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-xs text-gray-500"
                    >
                      No tasks created for this project yet.
                    </td>
                  </tr>
                ) : (
                  project.tasks?.map((t) => {
                    const isRunning = activeTimer?.taskId === t.id;
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            <span className="font-mono text-xs text-blue-600 dark:text-cyan-400">
                              [{t.taskCode}]
                            </span>{" "}
                            {t.title}
                          </p>
                          {t.dependencyTask && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              Requires: [{t.dependencyTask.taskCode}]{" "}
                              {t.dependencyTask.title}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={t.status}
                            onChange={async (e) => {
                              await updateTaskMutation.mutateAsync({
                                taskId: t.id,
                                input: { status: e.target.value },
                              });
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="hold">Hold</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono">
                          {Number(t.loggedHours)}h / {Number(t.hoursToComplete)}
                          h
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-600 dark:text-cyan-400">
                          +{t.points} pts
                        </td>
                        <td className="py-3 pl-4 text-right">
                          {isRunning ? (
                            <button
                              onClick={() =>
                                stopTimerMutation.mutateAsync({ taskId: t.id })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-600"
                            >
                              <Square className="h-3 w-3 fill-white" />
                              Stop
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                startTimerMutation.mutateAsync(t.id)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-cyan-400"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              Start
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Team Members */}
      {activeTab === "members" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Assigned Project Members
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Engineers, architects, and managers allocating capacity to this
                project.
              </p>
            </div>
            <button
              onClick={() => setShowMemberModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Member
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {project.members?.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3.5"
              >
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    {m.employee.fullName}{" "}
                    <span className="font-mono text-gray-400">
                      ({m.employee.employeeCode})
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Role:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {m.role}
                    </span>{" "}
                    • Rate: ${Number(m.hourlyRate)}/hr
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {Number(m.loggedHours)}h logged
                  </span>
                  <button
                    onClick={() =>
                      removeMemberMutation.mutateAsync({
                        projectId,
                        employeeId: m.employeeId,
                      })
                    }
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Expenses */}
      {activeTab === "expenses" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Project Incurred Expenses
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically rolled up into actualCost for budget variance
                tracking.
              </p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Expense
            </button>
          </div>

          <div className="mt-2 rounded-xl bg-gray-50 p-4 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            Total Incurred Spend:{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              {formatCurrency(Number(project.actualCost))}
            </span>
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Add Project Milestone
            </h3>
            <form
              onSubmit={handleAddMilestone}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g. Phase 1 Security Signoff"
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Target Delivery Date
                </label>
                <input
                  type="date"
                  required
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMilestoneModal(false)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Create Project Task
            </h3>
            {taskError && (
              <p className="mt-2 text-xs font-bold text-rose-600">
                {taskError}
              </p>
            )}
            <form onSubmit={handleAddTask} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Implement API Endpoint"
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="low">Low (+5 pts)</option>
                    <option value="medium">Medium (+10 pts)</option>
                    <option value="high">High (+20 pts)</option>
                    <option value="urgent">Urgent (+30 pts)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Prerequisite Task
                  </label>
                  <select
                    value={taskDepId}
                    onChange={(e) => setTaskDepId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">None</option>
                    {project.tasks?.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.taskCode}] {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Add Team Member
            </h3>
            <form
              onSubmit={handleAddMember}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Employee ID
                </label>
                <input
                  type="number"
                  required
                  value={memberEmployeeId}
                  onChange={(e) => setMemberEmployeeId(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Role
                  </label>
                  <input
                    type="text"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    value={memberRate}
                    onChange={(e) => setMemberRate(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Add to Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Record Project Expense
            </h3>
            <form
              onSubmit={handleAddExpense}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Amount ($)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Expense Date
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={expenseVendor}
                    onChange={(e) => setExpenseVendor(e.target.value)}
                    placeholder="e.g. AWS"
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Reference No
                  </label>
                  <input
                    type="text"
                    value={expenseRef}
                    onChange={(e) => setExpenseRef(e.target.value)}
                    placeholder="e.g. INV-1002"
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
