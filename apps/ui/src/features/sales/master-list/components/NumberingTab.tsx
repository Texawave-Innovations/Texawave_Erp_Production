"use client";

import { useMemo, useState } from "react";
import { Hash, Pencil } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  ErrorState,
  FormField,
  Input,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import {
  useCodeFormats,
  useRunningNumbers,
  useSetRunningNumber,
  useUpdateCodeFormat,
} from "../hooks";
import {
  codeFormatSchema,
  runningNumberSchema,
  type CodeFormatValues,
  type RunningNumberValues,
} from "../schema";
import {
  CODE_TYPE_LABEL,
  type CodeFormat,
  type CodeType,
  type RunningNumber,
} from "../types";

interface Row {
  format: CodeFormat;
  running: RunningNumber | null;
}

function FormatDialog({
  format,
  onClose,
}: {
  format: CodeFormat;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const update = useUpdateCodeFormat();
  const schema = useMemo(
    () => codeFormatSchema(format.codeType),
    [format.codeType],
  );
  const [values, setValues] = useState<CodeFormatValues>({
    prefix: format.prefix,
    padding: String(format.padding),
  });
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(schema, values);
  const set = (k: keyof CodeFormatValues, v: string) => {
    changed(k);
    setValues((s) => ({ ...s, [k]: v }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
    setError(null);
    try {
      const saved = await update.mutateAsync({
        codeType: format.codeType,
        body: {
          prefix: values.prefix.trim().toUpperCase(),
          padding: Number(values.padding),
        },
      });
      toast({
        title: `${CODE_TYPE_LABEL[format.codeType]} format saved — next: ${saved.example}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "INVALID_PREFIX") {
        setServerErrors({ prefix: err.message });
      }
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${CODE_TYPE_LABEL[format.codeType]} number format`}
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert variant="error" title="Not saved">
            {error}
          </Alert>
        ) : null}
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          Only codes issued after saving change; issued ones keep their number.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Prefix"
            required
            errorVariant="bubble"
            error={errorFor("prefix")}
          >
            {(f) => (
              <Input
                {...f}
                maxLength={format.codeType === "customer" ? 10 : 20}
                value={values.prefix}
                onBlur={() => touch("prefix")}
                onChange={(e) => set("prefix", e.target.value.toUpperCase())}
              />
            )}
          </FormField>
          <FormField
            label="Digits"
            required
            errorVariant="bubble"
            error={errorFor("padding")}
            hint="Minimum width of the running number."
          >
            {(f) => (
              <Input
                {...f}
                inputMode="numeric"
                maxLength={1}
                value={values.padding}
                onBlur={() => touch("padding")}
                onChange={(e) => set("padding", e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save format
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NumberDialog({
  running,
  onClose,
}: {
  running: RunningNumber;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const set = useSetRunningNumber();
  const [values, setValues] = useState<RunningNumberValues>({
    lastNumber: String(running.lastNumber),
  });
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(runningNumberSchema, values);
  const label = CODE_TYPE_LABEL[running.codeType];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
    setError(null);
    try {
      const saved = await set.mutateAsync({
        codeType: running.codeType,
        body: {
          lastNumber: Number(values.lastNumber),
          fiscalYear: running.fiscalYear,
        },
      });
      toast({
        title: `${label}: next number is ${saved.nextCode}`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.errorCode === "RUNNING_NUMBER_IN_USE"
      ) {
        setServerErrors({ lastNumber: err.message });
      }
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <Dialog open onClose={onClose} title={`${label} running number`}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert variant="error" title="Not saved">
            {error}
          </Alert>
        ) : null}
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          Financial year {running.fiscalYear}. Enter the last number used — for
          example 100 makes the next one …/0101. It cannot go below a number
          already issued.
        </p>
        <FormField
          label="Last number used"
          required
          errorVariant="bubble"
          error={errorFor("lastNumber")}
        >
          {(f) => (
            <Input
              {...f}
              inputMode="numeric"
              maxLength={8}
              value={values.lastNumber}
              onBlur={() => touch("lastNumber")}
              onChange={(e) => {
                changed("lastNumber");
                setValues({ lastNumber: e.target.value });
              }}
            />
          )}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={set.isPending}>
            Save number
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Code formats (prefix and width) and running numbers, one row per code. */
export function NumberingTab() {
  const canWrite = usePermission(SALES_PERMISSIONS.masterWrite);
  const canSetNumber = usePermission(SALES_PERMISSIONS.runningNumberWrite);
  const formats = useCodeFormats();
  const numbers = useRunningNumbers();
  const [editing, setEditing] = useState<
    { kind: "format"; row: Row } | { kind: "number"; row: Row } | null
  >(null);

  if (formats.isPending || numbers.isPending) {
    return <TableSkeleton rowsCount={7} columnsCount={5} />;
  }
  if (formats.isError || numbers.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void formats.refetch();
          void numbers.refetch();
        }}
      />
    );
  }
  const byType = new Map<CodeType, RunningNumber>(
    numbers.data.map((n) => [n.codeType, n]),
  );
  const rows: Row[] = formats.data.map((format) => ({
    format,
    running: byType.get(format.codeType) ?? null,
  }));

  return (
    <div className="flex flex-col gap-3">
      <DataTable<Row>
        caption="Code formats and running numbers"
        rows={rows}
        getRowKey={(r) => r.format.codeType}
        columns={[
          {
            header: "Code",
            cell: (r) => (
              <span className="font-medium text-gray-900 dark:text-white/90">
                {CODE_TYPE_LABEL[r.format.codeType]}
              </span>
            ),
          },
          {
            header: "Format",
            cell: (r) => (
              <span className="font-mono text-theme-sm">
                {r.format.prefix} · {r.format.padding} digits
              </span>
            ),
          },
          {
            header: "Last issued",
            cell: (r) =>
              r.running ? (
                <span className="font-mono text-theme-sm">
                  {r.running.lastCode ?? "None yet"}
                </span>
              ) : (
                "—"
              ),
          },
          {
            header: "Next",
            cell: (r) => (
              <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                {r.running?.nextCode ?? r.format.example}
              </span>
            ),
          },
          {
            header: "Actions",
            align: "right",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${CODE_TYPE_LABEL[r.format.codeType]} format`}
                    onClick={() => setEditing({ kind: "format", row: r })}
                  >
                    <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                    Format
                  </Button>
                ) : null}
                {canSetNumber && r.running ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Set ${CODE_TYPE_LABEL[r.format.codeType]} running number`}
                    onClick={() => setEditing({ kind: "number", row: r })}
                  >
                    <Hash className="mr-1 h-4 w-4" aria-hidden="true" />
                    Number
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Document numbers restart every financial year (April–March), e.g.
        TW/QUO/26-27/0001.
      </p>
      {editing?.kind === "format" ? (
        <FormatDialog
          format={editing.row.format}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "number" && editing.row.running ? (
        <NumberDialog
          running={editing.row.running}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
