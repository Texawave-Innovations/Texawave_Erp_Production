"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  ListTodo,
  Loader2,
  Save,
  Sliders,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  usePointsConfig,
  usePointsLeaderboard,
  useUpdatePointsConfig,
} from "@/features/projects/hooks";
import type { PointsConfig } from "@/features/projects/types";

function PriorityConfigForm({
  initialConfig,
}: {
  initialConfig?: PointsConfig | undefined;
}) {
  const updateConfigMutation = useUpdatePointsConfig();

  const [urgent, setUrgent] = useState<number>(initialConfig?.urgent ?? 30);
  const [high, setHigh] = useState<number>(initialConfig?.high ?? 20);
  const [medium, setMedium] = useState<number>(initialConfig?.medium ?? 10);
  const [low, setLow] = useState<number>(initialConfig?.low ?? 5);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await updateConfigMutation.mutateAsync({
        urgent: Number(urgent) || 30,
        high: Number(high) || 20,
        medium: Number(medium) || 10,
        low: Number(low) || 5,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save points rules",
      );
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Priority Points Configuration
          </h2>
        </div>
      </div>

      <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
        When an engineer marks a task 100% completed, the points configured
        below are credited directly to their ledger.
      </p>

      {saveSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
          Points configuration rules successfully updated!
        </div>
      )}

      {saveError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 dark:border-rose-900/30 dark:bg-rose-950/20">
          <div>
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
              Urgent Priority
            </span>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
              Critical bugs, system blockers
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="500"
              value={urgent}
              onChange={(e) => setUrgent(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-white p-2 text-right font-mono text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="font-mono text-xs text-gray-500">pts</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              High Priority
            </span>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
              Primary feature deliverables
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="500"
              value={high}
              onChange={(e) => setHigh(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-white p-2 text-right font-mono text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="font-mono text-xs text-gray-500">pts</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/30 dark:bg-blue-950/20">
          <div>
            <span className="text-xs font-bold text-blue-800 dark:text-cyan-300">
              Medium Priority
            </span>
            <p className="text-[11px] text-blue-600/80 dark:text-cyan-400/80">
              Standard work packages
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="500"
              value={medium}
              onChange={(e) => setMedium(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-white p-2 text-right font-mono text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="font-mono text-xs text-gray-500">pts</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/40">
          <div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-300">
              Low Priority
            </span>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Minor polish, documentation
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="500"
              value={low}
              onChange={(e) => setLow(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-white p-2 text-right font-mono text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="font-mono text-xs text-gray-500">pts</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={updateConfigMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            {updateConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Rules...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Points Rules
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PointsMasterPage() {
  const { data: config, isLoading: loadingConfig } = usePointsConfig();
  const { data: leaderboard, isLoading: loadingLeaderboard } =
    usePointsLeaderboard();

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Gamification Engine & Points Master
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure automated priority rewards and view the top contributor
            leaderboard.
          </p>
        </div>

        <Link
          href="/projects/my-work"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <ListTodo className="h-4 w-4" />
          My Assigned Work
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Priority Rules Config (5 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {loadingConfig ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-cyan-400" />
            </div>
          ) : (
            <PriorityConfigForm
              key={config ? "loaded" : "loading"}
              initialConfig={config}
            />
          )}
        </div>

        {/* Right Column: Leaderboard / Hall of Fame (7 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-transparent p-5 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Engineering Hall of Fame
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Top contributors ranked by completed assignments and earned
                    points.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4">
              {loadingLeaderboard ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
                </div>
              ) : !leaderboard || leaderboard.length === 0 ? (
                <div className="py-16 text-center text-xs text-gray-400">
                  No gamification activity recorded yet. Complete tasks to earn
                  points!
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                  {leaderboard.map((entry, idx) => {
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const isThird = idx === 2;

                    return (
                      <div
                        key={entry.employeeId}
                        className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-extrabold ${
                              isFirst
                                ? "bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30"
                                : isSecond
                                  ? "bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-200"
                                  : isThird
                                    ? "bg-amber-700/60 text-white"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            #{idx + 1}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                              <span>
                                {entry.employee?.fullName ||
                                  `Employee #${entry.employeeId}`}
                              </span>
                              {isFirst && (
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {entry.employee?.designation?.name ||
                                "Engineering"}{" "}
                              • {entry.tasksCompletedCount}{" "}
                              {entry.tasksCompletedCount === 1
                                ? "task"
                                : "tasks"}{" "}
                              completed
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1 font-mono text-xs font-extrabold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            <Award className="h-3.5 w-3.5 text-amber-500" />
                            {entry.totalPoints} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
