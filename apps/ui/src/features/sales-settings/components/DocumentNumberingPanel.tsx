"use client";

import type {
  DocumentNumbering,
  SalesDocumentType,
} from "@texawave-erp/api-types";
import { SALES_DOCUMENT_TYPES } from "@texawave-erp/api-types";
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
import { useDocumentNumbering, useUpdateDocumentNumbering } from "../hooks";
import {
  DOCUMENT_NUMBERING_READ,
  DOCUMENT_NUMBERING_WRITE,
} from "../permissions";
import { documentNumberingSchema } from "../schema";
import { SALES_DOCUMENT_TYPE_LABELS } from "../utils";

/** One docType's prefix/padding row, saved independently via its own PUT
 * (Docs/SALES_SETTINGS_FOUNDATION.md — "nextNumber untouched"). */
function DocTypeRow({
  docType,
  row,
}: {
  docType: SalesDocumentType;
  row: DocumentNumbering | undefined;
}) {
  const canWrite = usePermission(DOCUMENT_NUMBERING_WRITE);
  const update = useUpdateDocumentNumbering();
  const { toast } = useToast();
  const [prefix, setPrefix] = useState(row?.prefix ?? "");
  const [padding, setPadding] = useState(row?.padding ?? 6);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const result = documentNumberingSchema.safeParse({ prefix, padding });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid value");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ docType, input: result.data });
      toast({
        title: `${SALES_DOCUMENT_TYPE_LABELS[docType] ?? docType} numbering saved`,
        variant: "success",
      });
    } catch {
      toast({ title: "Could not save numbering", variant: "error" });
    }
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 border-b border-gray-100 py-3 last:border-0 sm:grid-cols-[1fr_140px_100px] dark:border-gray-800">
      <FormField
        label={SALES_DOCUMENT_TYPE_LABELS[docType] ?? docType}
        error={error ?? undefined}
      >
        {(fp) => (
          <Input
            {...fp}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            disabled={!canWrite || update.isPending}
            placeholder="e.g. SQFY"
          />
        )}
      </FormField>
      <FormField label="Padding">
        {(fp) => (
          <Input
            {...fp}
            type="number"
            min={1}
            max={10}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            disabled={!canWrite || update.isPending}
          />
        )}
      </FormField>
      {canWrite ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
      ) : null}
    </div>
  );
}

/** Numbering sub-tab — 8 prefix inputs, one per `SALES_DOCUMENT_TYPES`, each
 * independently saved. `GET` always returns all 8, synthesizing defaults. */
export function DocumentNumberingPanel() {
  const canRead = usePermission(DOCUMENT_NUMBERING_READ);
  const query = useDocumentNumbering();

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to document numbering"
      >
        Ask an administrator for the <code>{DOCUMENT_NUMBERING_READ}</code>{" "}
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

  const byDocType = new Map(query.data.map((row) => [row.docType, row]));

  return (
    <Card>
      <div className="flex flex-col p-1">
        {SALES_DOCUMENT_TYPES.map((docType) => (
          <DocTypeRow
            key={docType}
            docType={docType}
            row={byDocType.get(docType)}
          />
        ))}
      </div>
    </Card>
  );
}
