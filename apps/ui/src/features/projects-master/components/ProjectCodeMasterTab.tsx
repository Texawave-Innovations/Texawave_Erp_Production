"use client";

import type { ProjectCodeMaster } from "@texawave-erp/api-types";
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
import { useProjectCodeMaster, useUpdateProjectCodeMaster } from "../hooks";
import {
  PROJECT_CODE_MASTER_READ,
  PROJECT_CODE_MASTER_WRITE,
} from "../permissions";
import { projectCodeMasterSchema } from "../schema";

/** Owns the form state, seeded once from the loaded row — a fresh instance
 * mounts per fetched row rather than syncing state in an effect. */
function ProjectCodeMasterForm({ initial }: { initial: ProjectCodeMaster }) {
  const canWrite = usePermission(PROJECT_CODE_MASTER_WRITE);
  const { toast } = useToast();
  const update = useUpdateProjectCodeMaster();

  const [companyPrefix, setCompanyPrefix] = useState(initial.companyPrefix);
  const [moduleIdentifier, setModuleIdentifier] = useState(
    initial.moduleIdentifier,
  );
  const [defaultProjectCode, setDefaultProjectCode] = useState(
    initial.defaultProjectCode,
  );
  const [financialYear, setFinancialYear] = useState(initial.financialYear);
  const [sequenceDigits, setSequenceDigits] = useState(initial.sequenceDigits);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sequencePreview = "0".repeat(Math.max(sequenceDigits - 1, 0)) + "1";
  const previewCode = [
    companyPrefix,
    moduleIdentifier,
    defaultProjectCode || "—",
    financialYear,
    sequencePreview,
  ]
    .filter(Boolean)
    .join("/");

  async function handleSave() {
    const result = projectCodeMasterSchema.safeParse({
      companyPrefix,
      moduleIdentifier,
      defaultProjectCode,
      financialYear,
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
      toast({ title: "Project code format saved", variant: "success" });
    } catch {
      toast({ title: "Could not save the code format", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        Project Code Generation Pattern & Standard
      </h2>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        Format pattern: [Prefix] / [Category] / [Project Code] / [Year] /
        [Sequence]
      </p>

      <Card>
        <div className="flex flex-col gap-1 p-1">
          <span className="text-theme-xs font-semibold uppercase text-success-600 dark:text-success-400">
            Active generated project code format
          </span>
          <span className="text-theme-xl font-bold text-gray-900 dark:text-white/90">
            {previewCode}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <FormField label="Company Prefix" error={errors.companyPrefix}>
          {(fp) => (
            <Input
              {...fp}
              value={companyPrefix}
              onChange={(e) => setCompanyPrefix(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "TW" for TexaWave'
            />
          )}
        </FormField>
        <FormField label="Module Identifier" error={errors.moduleIdentifier}>
          {(fp) => (
            <Input
              {...fp}
              value={moduleIdentifier}
              onChange={(e) => setModuleIdentifier(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "PRJ" for Projects'
            />
          )}
        </FormField>
        <FormField
          label="Default Project Code"
          error={errors.defaultProjectCode}
        >
          {(fp) => (
            <Input
              {...fp}
              value={defaultProjectCode}
              onChange={(e) => setDefaultProjectCode(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "ME", "SW", "EC"'
            />
          )}
        </FormField>
        <FormField label="Year / Financial Year" error={errors.financialYear}>
          {(fp) => (
            <Input
              {...fp}
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              disabled={!canWrite || update.isPending}
              placeholder='e.g. "26-27"'
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
            Save Code Master
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Tab 2: Project Code Master — configures
 * `[Prefix]/[Category]/[Project Code]/[Year]/[Sequence]`. One row per org,
 * saved via a single PUT (mirrors
 * apps/ui/src/features/sales-settings/components/DocumentNumberingPanel.tsx). */
export function ProjectCodeMasterTab() {
  const canRead = usePermission(PROJECT_CODE_MASTER_READ);
  const query = useProjectCodeMaster();

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Project Code Master"
      >
        Ask an administrator for the <code>{PROJECT_CODE_MASTER_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return <ProjectCodeMasterForm initial={query.data} />;
}
