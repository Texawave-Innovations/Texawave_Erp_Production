"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  File,
  Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import {
  Alert,
  Button,
  ErrorState,
  Input,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  ExecutiveHeroBanner,
  ExecutiveSectionCard,
} from "@/features/hr/components";
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
  if (!bytes) return "—";
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
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700">
      <div>
        {/* Header: Document Title & Type Badge */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="truncate text-xs font-bold text-slate-900 dark:text-white"
            title={doc.label ?? doc.documentType}
          >
            {doc.label ?? doc.documentType}
          </span>
          {isPdf ? (
            <span className="shrink-0 rounded-md border border-rose-200/70 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400">
              PDF
            </span>
          ) : isImage ? (
            <span className="shrink-0 rounded-md border border-sky-200/70 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0284c7] dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
              Image
            </span>
          ) : (
            <span className="shrink-0 rounded-md border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              Doc
            </span>
          )}
        </div>

        {/* Document Preview Box / Download Trigger */}
        <button
          type="button"
          onClick={() =>
            void downloadEmployeeDocument(employeeId, doc.id, doc.fileName)
          }
          className="mt-3 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 text-xs font-medium text-slate-600 transition-all group-hover:border-sky-400 group-hover:bg-sky-50/80 group-hover:text-brand- dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 dark:group-hover:border-sky-700 dark:group-hover:text-sky-300 cursor-pointer"
        >
          {isImage ? (
            <ImageIcon className="h-6 w-6 text-sky-500 transition-transform group-hover:scale-110" />
          ) : isPdf ? (
            <FileText className="h-6 w-6 text-rose-500 transition-transform group-hover:scale-110" />
          ) : (
            <File className="h-6 w-6 text-brand-500 transition-transform group-hover:scale-110" />
          )}
          <span className="font-semibold text-[11px]">
            {isImage ? "View / Download Image" : "Download File"}
          </span>
        </button>
      </div>

      {/* Footer Info: File Size & Remove Action */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="font-medium">{formatSize(doc.sizeBytes)}</span>
        {canWrite && doc.source === "HR_UPLOADED" ? (
          <button
            type="button"
            onClick={() => onDelete(doc.id)}
            className="inline-flex items-center gap-1 font-semibold text-rose-600 transition-colors hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Remove</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Detailed employee documents view.
 * Features an Executive Hero Banner, styled Upload Card, and organized Standard & Other Document sections.
 */
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
    <div className="flex flex-col gap-6">
      {/* Subpage Executive Hero Banner */}
      <ExecutiveHeroBanner
        backHref="/hr/employee-documents"
        backLabel="Employee Documents"
        title={`Documents – ${employee.data?.fullName ?? "Loading…"}`}
        icon3d="documents"
        iconAlt="Employee Documents"
        badge={
          employee.data ? (
            <span className="rounded-full border border-sky-300/60 bg-sky-100/90 px-3 py-1 text-xs font-semibold text-[#0a3271] dark:border-sky-800 dark:bg-sky-950/80 dark:text-sky-200">
              {employee.data.employeeCode}
            </span>
          ) : null
        }
        details={
          employee.data ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                <strong className="text-[#0a3271] dark:text-sky-200">Department:</strong>{" "}
                {employee.data.team.name}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                <strong className="text-[#0a3271] dark:text-sky-200">Designation:</strong>{" "}
                {employee.data.designation?.name || "—"}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                <strong className="text-[#0a3271] dark:text-sky-200">Total Documents:</strong>{" "}
                {documents.data?.length ?? 0} files
              </span>
            </div>
          ) : null
        }
        actions={
          <Link
            href="/hr/employee-documents"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Documents</span>
          </Link>
        }
      />

      {/* Upload Section Card */}
      {canWrite ? (
        <ExecutiveSectionCard
          title="Upload New Document"
          description="Attach identity proof, educational degrees, or custom compliance records (PDF, JPG, PNG up to 5 MB)."
          icon3d="documents"
        >
          {error ? (
            <div className="mb-4">
              <Alert variant="error" title="Upload failed">
                {error}
              </Alert>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
            <div className="md:col-span-5">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Document Name
              </label>
              <Input
                placeholder="e.g. Offer Letter, Relieving Letter, Degree"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Select File</span>
                {file && (
                  <span className="max-w-40 truncate text-[11px] font-semibold text-[#0284c7] dark:text-sky-300">
                    ✓ {file.name}
                  </span>
                )}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0284c7] hover:file:bg-sky-100 dark:text-slate-300 dark:file:bg-sky-950 dark:file:text-sky-300 cursor-pointer"
              />
            </div>

            <div className="md:col-span-3">
              <Button
                onClick={handleUpload}
                disabled={upload.isPending}
                className="w-full gap-2 rounded-xl bg-linear-to-r from-brand-500 to-brand-600 py-2.5 font-semibold text-white shadow-xs hover:from-brand-600 hover:to-brand-700 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>{upload.isPending ? "Uploading…" : "Upload Document"}</span>
              </Button>
            </div>
          </div>
        </ExecutiveSectionCard>
      ) : null}

      {/* Standard Documents Section */}
      <ExecutiveSectionCard
        title="Standard Onboarding Documents"
        description="Official onboarding identity documents submitted during employee verification."
        icon3d="documents"
        action={
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800">
            {onboardingDocs.length} files
          </span>
        }
      >
        {documents.isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : onboardingDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200/90 bg-sky-50/30 p-10 text-center dark:border-sky-900/50 dark:bg-sky-950/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-[#0284c7] dark:bg-sky-900/50 dark:text-sky-300">
              <FileText className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
              No Onboarding Documents Yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              Identity proofs and onboarding documents submitted by this employee will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </ExecutiveSectionCard>

      {/* Other Documents Section */}
      <ExecutiveSectionCard
        title="Other & HR Uploaded Documents"
        description="Additional letters, contracts, and supplementary records uploaded by HR administrators."
        icon3d="documents"
        action={
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800">
            {hrDocs.length} files
          </span>
        }
      >
        {hrDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No supplementary HR documents uploaded for this employee yet. Use the upload form above to add one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
      </ExecutiveSectionCard>
    </div>
  );
}
