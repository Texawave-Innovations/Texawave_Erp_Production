"use client";

import type {
  ProjectCodeMaster,
  TaskRunningNumberMaster,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  useProjectCodeMaster,
  useTaskRunningNumberMaster,
  useUpdateTaskRunningNumberMaster,
} from "../hooks";
import {
  TASK_RUNNING_NUMBER_MASTER_READ,
  TASK_RUNNING_NUMBER_MASTER_WRITE,
} from "../permissions";
import { taskRunningNumberMasterSchema } from "../schema";

function projectCodePreview(projectCode: ProjectCodeMaster | undefined) {
  if (!projectCode) return "—";
  return [
    projectCode.companyPrefix,
    projectCode.moduleIdentifier,
    projectCode.defaultProjectCode || "—",
    projectCode.financialYear,
    "0".repeat(Math.max(projectCode.sequenceDigits - 1, 0)) + "1",
  ]
    .filter(Boolean)
    .join("/");
}

/** Owns the form state, seeded once from the loaded row — a fresh instance
 * mounts per fetched row rather than syncing state in an effect. */
function TaskRunningNumberMasterForm({
  initial,
  projectCode,
}: {
  initial: TaskRunningNumberMaster;
  projectCode: ProjectCodeMaster | undefined;
}) {
  const canWrite = usePermission(TASK_RUNNING_NUMBER_MASTER_WRITE);
  const { toast } = useToast();
  const update = useUpdateTaskRunningNumberMaster();

  const [taskPrefix, setTaskPrefix] = useState(initial.taskPrefix);
  const [separator, setSeparator] = useState(initial.separator);
  const [sequenceDigits, setSequenceDigits] = useState(initial.sequenceDigits);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const taskSequence = "0".repeat(Math.max(sequenceDigits - 1, 0)) + "1";
  const previewCode = `${projectCodePreview(projectCode)}${separator}${taskPrefix}${taskSequence}`;

  async function handleSave() {
    const result = taskRunningNumberMasterSchema.safeParse({
      taskPrefix,
      separator,
      sequenceDigits,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync(result.data);
      toast({ title: "Task code format saved", variant: "success" });
    } catch {
      toast({ title: "Could not save the task code format", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Task Code & Running Number Generation Standard
      </h2>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        Format pattern: [Project Code] [Separator] [Task Tag] [Sequence Number]
      </p>

      <Card>
        <div className="flex flex-col gap-1 p-1">
          <span className="text-theme-xs font-semibold uppercase text-success-600 dark:text-success-400">
            Active generated task code format
          </span>
          <span className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
            {previewCode}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            Auto-generated per project deliverable: starts at the first sequence
            value and auto-increments with each new task created.
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Task Prefix / Tag" error={errors.taskPrefix}>
          {(fp) => (
            <Input
              {...fp}
              value={taskPrefix}
              onChange={(e) => setTaskPrefix(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "T" for Task'
            />
          )}
        </FormField>
        <FormField label="Separator" error={errors.separator}>
          {(fp) => (
            <Input
              {...fp}
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "-" or "/"'
            />
          )}
        </FormField>
        <FormField label="Sequence Digits" error={errors.sequenceDigits}>
          {(fp) => (
            <Input
              {...fp}
              type="number"
              min={1}
              max={10}
              value={sequenceDigits}
              onChange={(e) => setSequenceDigits(Number(e.target.value))}
              disabled={!canWrite || update.isPending}
            />
          )}
        </FormField>
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <Button loading={update.isPending} onClick={() => void handleSave()}>
            Save Task Code Master
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Tab 3: Task Running Number Master — configures
 * `[Project Code][Separator][Task Tag][Sequence]`, appended to the Project
 * Code Master's generated code. */
export function TaskRunningNumberMasterTab() {
  const canRead = usePermission(TASK_RUNNING_NUMBER_MASTER_READ);
  const query = useTaskRunningNumberMaster();
  const projectCodeQuery = useProjectCodeMaster();

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Task Running Number Master"
      >
        Ask an administrator for the{" "}
        <code>{TASK_RUNNING_NUMBER_MASTER_READ}</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <TaskRunningNumberMasterForm
      initial={query.data}
      projectCode={projectCodeQuery.data}
    />
  );
}
