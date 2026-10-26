"use client";

import { ApiError } from "@texawave-erp/core";
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
import { useAuthorizedSignatory, useUpsertAuthorizedSignatory } from "../hooks";
import {
  AUTHORIZED_SIGNATORY_READ,
  AUTHORIZED_SIGNATORY_WRITE,
} from "../permissions";
import { sanitizeName } from "../sanitize";
import {
  authorizedSignatorySchema,
  type AuthorizedSignatoryFormValues,
} from "../schema";

/** Bank & Signatory tab (signatory half) — singleton, PUT always upserts
 * (Docs/SALES_SETTINGS_FOUNDATION.md design decision #5). */
export function AuthorizedSignatoryForm() {
  const canRead = usePermission(AUTHORIZED_SIGNATORY_READ);
  const canWrite = usePermission(AUTHORIZED_SIGNATORY_WRITE);
  const query = useAuthorizedSignatory();
  const upsert = useUpsertAuthorizedSignatory();
  const { toast } = useToast();

  const [values, setValues] = useState<AuthorizedSignatoryFormValues | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to the authorized signatory"
      >
        Ask an administrator for the <code>{AUTHORIZED_SIGNATORY_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const current: AuthorizedSignatoryFormValues = values ?? {
    name: query.data?.name ?? "",
    designation: query.data?.designation ?? "",
  };

  function setField<K extends keyof AuthorizedSignatoryFormValues>(
    key: K,
    value: AuthorizedSignatoryFormValues[K],
  ) {
    setValues({ ...current, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = authorizedSignatorySchema.safeParse(current);
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
    setSubmitError(null);
    try {
      const input = Object.fromEntries(
        Object.entries(result.data).filter(([, v]) => v !== ""),
      );
      await upsert.mutateAsync(input);
      toast({ title: "Authorized signatory saved", variant: "success" });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.isPermissionError
          ? `You don't have the ${AUTHORIZED_SIGNATORY_WRITE} permission.`
          : "Could not save the authorized signatory. Try again.",
      );
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Authorized signatory
        </h3>
        <FormField label="Name" error={errors.name}>
          {(fp) => (
            <Input
              {...fp}
              value={current.name}
              onChange={(e) => setField("name", sanitizeName(e.target.value))}
              disabled={!canWrite || upsert.isPending}
            />
          )}
        </FormField>
        <FormField label="Designation" error={errors.designation}>
          {(fp) => (
            <Input
              {...fp}
              value={current.designation}
              onChange={(e) =>
                setField("designation", sanitizeName(e.target.value))
              }
              disabled={!canWrite || upsert.isPending}
            />
          )}
        </FormField>
        {submitError ? (
          <p className="text-theme-xs text-error-600 dark:text-error-400">
            {submitError}
          </p>
        ) : null}
        {canWrite ? (
          <div className="flex justify-end">
            <Button type="submit" loading={upsert.isPending}>
              Save signatory
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
