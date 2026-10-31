"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  ListTodo,
  Plus,
  Save,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  usePointsConfig,
  usePointsLeaderboard,
  useUpdatePointsConfig,
} from "@/features/projects/hooks";
import { errorMessage } from "@/features/projects/format";
import { PageBanner } from "@/features/projects/components/PageBanner";
import type { PointsConfig } from "@/features/projects/types";

type PriorityKey = "low" | "medium" | "high" | "urgent";

const PRIORITY_TIERS: {
  key: PriorityKey;
  label: string;
  hint: string;
  fallback: number;
  className: string;
}[] = [
  {
    key: "low",
    label: "Low Priority",
    hint: "Minor polish, documentation",
    fallback: 5,
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  },
  {
    key: "medium",
    label: "Medium Priority",
    hint: "Standard work packages",
    fallback: 10,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300",
  },
  {
    key: "high",
    label: "High Priority",
    hint: "Primary feature deliverables",
    fallback: 20,
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  },
  {
    key: "urgent",
    label: "Urgent Priority",
    hint: "Critical bugs, system blockers",
    fallback: 30,
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300",
  },
];

const FORM_ID = "points-master-form";

function PriorityConfigForm({
  initialConfig,
}: {
  initialConfig?: PointsConfig | undefined;
}) {
  const { toast } = useToast();
  const updateConfigMutation = useUpdatePointsConfig();

  const [points, setPoints] = useState<Record<PriorityKey, number>>({
    low: initialConfig?.low ?? 5,
    medium: initialConfig?.medium ?? 10,
    high: initialConfig?.high ?? 20,
    urgent: initialConfig?.urgent ?? 30,
  });
  const [customTypes, setCustomTypes] = useState<
    { name: string; points: number }[]
  >(
    Object.entries(initialConfig?.customRules ?? {}).map(([name, value]) => ({
      name,
      points: Number(value) || 0,
    })),
  );
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePoints, setNewTypePoints] = useState(15);
  const [formError, setFormError] = useState<string | null>(null);

  function handleAddCustomType() {
    const name = newTypeName.trim();
    if (!name) {
      setFormError("Please enter a deliverable type name.");
      return;
    }
    if (customTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setFormError(`"${name}" already exists.`);
      return;
    }
    setFormError(null);
    setCustomTypes((prev) => [
      ...prev,
      { name, points: Number(newTypePoints) || 0 },
    ]);
    setNewTypeName("");
    setNewTypePoints(15);
  }

  function updateCustomPoints(index: number, value: number) {
    setCustomTypes((prev) =>
      prev.map((t, i) => (i === index ? { ...t, points: value } : t)),
    );
  }

  function removeCustomType(index: number) {
    setCustomTypes((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const customRules = Object.fromEntries(
      customTypes
        .filter((t) => t.name.trim())
        .map((t) => [t.name.trim(), Number(t.points) || 0]),
    );

    try {
      await updateConfigMutation.mutateAsync({
        low: Number(points.low) || 5,
        medium: Number(points.medium) || 10,
        high: Number(points.high) || 20,
        urgent: Number(points.urgent) || 30,
        customRules,
      });
      toast({
        title: "Points master rules saved successfully",
        variant: "success",
      });
    } catch (err: unknown) {
      setFormError(errorMessage(err, "Failed to save points rules"));
    }
  };

  return (
    <form
      id={FORM_ID}
      onSubmit={handleSaveConfig}
      className="flex flex-col gap-4"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {formError}
        </p>
      ) : null}

      {/* Default Priority Points — legacy 4-tier grid */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Award className="h-5 w-5 text-amber-500" />
            Default Priority Points
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            These default point values automatically populate into new task
            forms when a priority is selected, and are credited when a task is
            marked 100% complete.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {PRIORITY_TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`flex flex-col gap-1.5 rounded-xl border p-3.5 ${tier.className}`}
            >
              <p className="text-xs font-black uppercase tracking-wider">
                {tier.label}
              </p>
              <Input
                type="number"
                min="1"
                max="500"
                aria-label={`${tier.label} points`}
                value={points[tier.key]}
                onChange={(e) =>
                  setPoints((prev) => ({
                    ...prev,
                    [tier.key]: Number(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-[10px] font-semibold opacity-75">
                {tier.hint} • points awarded on completion
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Deliverable Types — legacy add-row + list */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Custom Deliverable Types (Optional)
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Add point values for specialized deliverable categories beyond the 4
            priority tiers.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="w-full flex-1 min-w-0">
              <FormField label="Category Name">
                {(field) => (
                  <Input
                    {...field}
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomType();
                      }
                    }}
                    placeholder="e.g. Critical Bug Fix, Architecture Review"
                  />
                )}
              </FormField>
            </div>
            <div className="w-full sm:w-28 shrink-0">
              <FormField label="Points">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="500"
                    value={newTypePoints}
                    onChange={(e) =>
                      setNewTypePoints(Number(e.target.value) || 0)
                    }
                  />
                )}
              </FormField>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={handleAddCustomType}
            >
              <Plus className="h-4 w-4" />
              Add Type
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/20">
            {customTypes.length === 0 ? (
              <p className="py-2.5 px-4 text-center text-xs text-gray-400 dark:text-gray-500">
                No custom deliverable types added
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {customTypes.map((ct, idx) => (
                  <div
                    key={`${ct.name}-${idx}`}
                    className="flex items-center justify-between gap-3 bg-white px-3.5 py-2 text-xs sm:py-2.5 dark:bg-gray-900"
                  >
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {ct.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        aria-label={`${ct.name} points`}
                        value={ct.points}
                        onChange={(e) =>
                          updateCustomPoints(idx, Number(e.target.value) || 0)
                        }
                        className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        +{ct.points} pts
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCustomType(idx)}
                        aria-label={`Remove ${ct.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Button type="submit" loading={updateConfigMutation.isPending}>
        <Save className="h-4 w-4" />
        Save Points Rules
      </Button>
    </form>
  );
}

export default function PointsMasterPage() {
  const configQuery = usePointsConfig();
  const leaderboardQuery = usePointsLeaderboard();
  const leaderboard = leaderboardQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Header — legacy "Points Master Configuration" with Save Rules */}
      <PageBanner
        icon={Award}
        title="Points Master Configuration"
        description="Configure reward points awarded to team members upon completing tasks by priority or type, and view the contributor leaderboard."
        actions={
          <>
            <Link
              href="/projects/my-work"
              className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <ListTodo className="h-4 w-4" />
              My Assigned Work
            </Link>
            <Button type="submit" form={FORM_ID} disabled={!configQuery.data}>
              <Save className="h-4 w-4" />
              Save Rules
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Priority Rules Config */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {configQuery.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : configQuery.isError ? (
            <ErrorState
              title="Could not load points configuration"
              onRetry={() => configQuery.refetch()}
            />
          ) : (
            <PriorityConfigForm
              key={configQuery.data ? "loaded" : "empty"}
              initialConfig={configQuery.data}
            />
          )}
        </div>

        {/* Right Column: Leaderboard / Hall of Fame */}
        <div className="flex flex-col gap-5 lg:col-span-5">
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
              {leaderboardQuery.isPending ? (
                <div className="flex flex-col gap-2" aria-busy="true">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : leaderboardQuery.isError ? (
                <ErrorState
                  title="Could not load leaderboard"
                  onRetry={() => leaderboardQuery.refetch()}
                />
              ) : !leaderboard || leaderboard.length === 0 ? (
                <EmptyState
                  title="No reward activity yet"
                  description="Complete tasks to earn points!"
                />
              ) : (
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                  {leaderboard.map((entry, idx) => {
                    const isFirst = idx === 0;
                    const isSecond = idx === 1;
                    const isThird = idx === 2;

                    return (
                      <div
                        key={`${entry.employeeId ?? "entry"}-${idx}`}
                        className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold ${
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
                                <Star className="h-3.5 w-3.5 text-amber-500" />
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

                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          {entry.totalPoints} pts
                        </span>
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
