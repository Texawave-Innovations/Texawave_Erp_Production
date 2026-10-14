"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Input,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useEmployee } from "../../employees/hooks";
import { downloadEmployeeDocument } from "../api";
import type { EmployeeDocumentRow } from "../api";
import {
  useEmployeeDocuments,
  useRemoveEmployeeDocument,
  useUploadEmployeeDocument,
} from "../hooks";

const DOCUMENT_WRITE_SCOPE = [
  "hr.employee_document.write.own",
  "hr.employee_document.write.team",
  "hr.employee_document.write.all",
] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function DocumentCard({
  doc,
  canWrite,
  employeeId,
  onDelete,
}: {
  doc: EmployeeDocumentRow;
  canWrite: boolean;
  employeeId: number;
  onDelete: (id: number) => void;
}) {
  const isImage = doc.mimeType?.startsWith("image/");
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900 dark:text-white/90">
            {doc.label ?? doc.documentType}
          </span>
          {doc.mimeType === "application/pdf" ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-theme-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              PDF
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            void downloadEmployeeDocument(employeeId, doc.id, doc.fileName)
          }
          className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 text-theme-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400"
        >
          {isImage ? "View / download photo" : "Download document"}
        </button>
        <div className="flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{formatSize(doc.sizeBytes)}</span>
          {canWrite && doc.source === "HR_UPLOADED" ? (
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="text-error-500 hover:underline"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** "Documents – {employee name}": onboarding's documents (read-only here —
 * edited by the employee through the onboarding wizard) plus HR's own
 * ad-hoc uploads for this employee. */
export function EmployeeDocumentsDetailView({
  employeeId,
}: {
  employeeId: number;
}) {
  const employee = useEmployee(employeeId);
  const documents = useEmployeeDocuments(employeeId);
  const upload = useUploadEmployeeDocument(employeeId);
  const remove = useRemoveEmployeeDocument(employeeId);
  const canWrite = usePermission(DOCUMENT_WRITE_SCOPE);

  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    setError(null);
    if (!label.trim() || !file) {
      setError("Enter a document name and choose a file.");
      return;
    }
    upload.mutate(
      { label: label.trim(), file },
      {
        onSuccess: () => {
          setLabel("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: () =>
          setError(
            "Upload failed. Check the file type and size (PDF/JPG/PNG, 5 MB max).",
          ),
      },
    );
  };

  if (documents.isError) {
    return <ErrorState onRetry={() => void documents.refetch()} />;
  }

  const onboardingDocs = (documents.data ?? []).filter(
    (d) => d.source === "ONBOARDING",
  );
  const hrDocs = (documents.data ?? []).filter(
    (d) => d.source === "HR_UPLOADED",
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/hr/employee-documents"
          className="text-theme-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Back
        </Link>
        <h1 className="mt-1 text-theme-xl font-bold text-gray-900 dark:text-white/90">
          Documents – {employee.data?.fullName ?? "…"}
        </h1>
        {employee.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {employee.data.employeeCode} · {employee.data.team.name}
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <Card>
          <h2 className="mb-3 font-medium text-gray-900 dark:text-white/90">
            + Upload New Document
          </h2>
          {error ? (
            <Alert variant="error" title="Upload failed">
              {error}
            </Alert>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                Document Name
              </label>
              <Input
                placeholder="e.g. Offer Letter, Experience Certificate"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                Select File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-theme-sm text-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleUpload}
                disabled={upload.isPending}
                className="w-full"
              >
                {upload.isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <h2 className="font-medium text-gray-900 dark:text-white/90">
        Standard Documents
      </h2>
      {documents.isPending ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : onboardingDocs.length === 0 ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          No onboarding documents uploaded yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {onboardingDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              canWrite={canWrite}
              employeeId={employeeId}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </div>
      )}

      {hrDocs.length > 0 ? (
        <>
          <h2 className="font-medium text-gray-900 dark:text-white/90">
            Other Documents
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {hrDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                canWrite={canWrite}
                employeeId={employeeId}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
