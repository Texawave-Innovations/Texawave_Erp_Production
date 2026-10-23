"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCreateProject } from "@/features/projects/hooks";

function getDefaultStartDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultPlannedEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();
  const createMutation = useCreateProject();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [customerName, setCustomerName] = useState("");
  const [projectPrice, setProjectPrice] = useState<number>(50000);
  const [expectedHours, setExpectedHours] = useState<number>(120);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [plannedEndDate, setPlannedEndDate] = useState(
    getDefaultPlannedEndDate,
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name,
        department: department || undefined,
        customerName: customerName || undefined,
        projectPrice: Number(projectPrice) || 0,
        expectedHours: Number(expectedHours) || 0,
        startDate,
        plannedEndDate: plannedEndDate || undefined,
        description: description || undefined,
      });

      router.push(`/projects/${created.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create project");
      }
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projects/list"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Create New Project
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A sequential project code (e.g. PRJ-000001) will be automatically
            generated upon creation.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                placeholder="e.g. Global Supply Chain Portal"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering, IT, Design..."
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Client / Account Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Acme Corporation..."
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
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
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
                Scope & Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High-level project scope and target deliverables..."
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Link
              href="/projects/list"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-105 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
