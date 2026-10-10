"use client";

import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useState } from "react";
import {
  downloadMyDocument,
  type DocumentRecord,
} from "@/features/onboarding/api";
import { useMyDocuments } from "@/features/onboarding/hooks";

/**
 * The documents an employee uploaded during onboarding (photo, Aadhaar, PAN,
 * bank statement, certificates — apps/api/src/modules/employee-self-service/
 * profile/dto/onboarding-rules.ts DOCUMENT_TYPES), with download. Reuses the
 * same query the onboarding wizard and Profile page already use
 * (useMyDocuments, apps/ui/src/features/onboarding/hooks.ts) — this is a
 * dedicated view over the same data, not a second source of truth.
 */
export function MyDocumentsView() {
  const query = useMyDocuments();
  const { toast } = useToast();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  async function handleDownload(row: DocumentRecord) {
    setDownloadingType(row.documentType);
    try {
      await downloadMyDocument(row.documentType, row.fileName);
    } catch {
      toast({ title: "Could not download this document", variant: "error" });
    } finally {
      setDownloadingType(null);
    }
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
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to your documents"
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        My Documents
      </h1>

      {rows.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Documents you uploaded during onboarding appear here."
        />
      ) : (
        <DataTable<DocumentRecord>
          columns={[
            { header: "Type", cell: (row) => row.documentType },
            { header: "File name", cell: (row) => row.fileName },
            {
              header: "Uploaded",
              cell: (row) => new Date(row.uploadedAt).toLocaleDateString(),
            },
            {
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={downloadingType === row.documentType}
                  onClick={() => void handleDownload(row)}
                >
                  Download
                </Button>
              ),
            },
          ]}
          rows={rows}
          getRowKey={(row) => row.documentType}
        />
      )}
    </div>
  );
}
