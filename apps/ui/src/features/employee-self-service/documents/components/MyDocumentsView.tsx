"use client";

import {
  Alert,
  Button,
  Card,
  ErrorState,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  ShieldCheck,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  downloadMyDocument,
  fetchMyDocumentBlob,
  type DocumentRecord,
} from "@/features/onboarding/api";
import { useMyDocuments } from "@/features/onboarding/hooks";

// Legacy MyDocuments.tsx STANDARD_DOC_DEFS, keyed by this ERP's document
// types (apps/api .../profile/dto/onboarding-rules.ts DOCUMENT_TYPES).
const DOC_DEFS: Record<string, { label: string; icon: LucideIcon }> = {
  PROFILE_PHOTO: { label: "Profile Photo", icon: User },
  RESUME: { label: "Resume / CV", icon: FileText },
  AADHAAR: { label: "Aadhaar Card", icon: ShieldCheck },
  PAN: { label: "PAN Card", icon: CreditCard },
  BANK_STATEMENT: { label: "Bank Statement / Passbook", icon: CreditCard },
  CERT_10TH: { label: "10th Certificate", icon: GraduationCap },
  CERT_12TH: { label: "12th Certificate", icon: GraduationCap },
  CERT_GRADUATION: { label: "Graduation Certificate", icon: GraduationCap },
  CERT_POST_GRADUATION: {
    label: "Post Graduation Certificate",
    icon: GraduationCap,
  },
};
const ORDER = Object.keys(DOC_DEFS);

function kindOf(doc: DocumentRecord): "image" | "pdf" | "doc" {
  const mime = doc.mimeType ?? "";
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(doc.fileName))
    return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(doc.fileName)) return "pdf";
  return "doc";
}

/** An object URL for an image document's thumbnail (authenticated fetch). */
function useThumbnail(doc: DocumentRecord, enabled: boolean) {
  const query = useQuery({
    queryKey: ["my-document-thumb", doc.documentType, doc.uploadedAt],
    queryFn: () => fetchMyDocumentBlob(doc.documentType),
    enabled,
    staleTime: Infinity,
  });
  const url = useMemo(
    () => (query.data ? URL.createObjectURL(query.data) : null),
    [query.data],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

function DocumentCard({ doc }: { doc: DocumentRecord }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const def = DOC_DEFS[doc.documentType] ?? {
    label: doc.documentType,
    icon: FileText,
  };
  const kind = kindOf(doc);
  const thumb = useThumbnail(doc, kind === "image");

  async function view() {
    setBusy("view");
    try {
      const blob = await fetchMyDocumentBlob(doc.documentType);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({ title: "Could not open this document", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    try {
      await downloadMyDocument(doc.documentType, doc.fileName);
    } catch {
      toast({ title: "Could not download this document", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const badge =
    kind === "pdf"
      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40"
      : kind === "image"
        ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/40"
        : "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-900/60 dark:bg-brand-950/40";

  return (
    <Card className="group flex flex-col justify-between overflow-hidden p-0 transition-all duration-200 hover:shadow-lg">
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 p-4 pb-3 dark:border-gray-800 dark:bg-gray-800/40">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <def.icon
              className="h-4 w-4 shrink-0 text-brand-500"
              aria-hidden="true"
            />
            <span className="truncate">{def.label}</span>
          </h3>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge}`}
          >
            {kind === "image" ? "Image" : kind === "pdf" ? "PDF" : "Doc"}
          </span>
        </div>
        <div className="p-4">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800">
            {kind === "image" && thumb ? (
              <img
                src={thumb}
                alt={def.label}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FileText
                  className={`mb-2 h-12 w-12 ${kind === "pdf" ? "text-red-500" : "text-brand-500"}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {kind === "pdf"
                    ? "PDF Document"
                    : kind === "image"
                      ? "Image"
                      : "Attachment"}
                </span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gray-900/60 p-2 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "view"}
                onClick={() => void view()}
                aria-label={`View ${def.label}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "download"}
                onClick={() => void download()}
                aria-label={`Download ${def.label}`}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 p-3 px-4 dark:border-gray-800 dark:bg-gray-800/30">
        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="h-3 w-3" aria-hidden="true" />
          Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void view()}
        >
          Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

/**
 * "My Documents", laid out like the legacy page (TexaWave_ERP_old
 * src/modules/employee/MyDocuments.tsx): a gradient banner with the
 * document count, then the "Standard Verification Documents" card grid
 * (type icon, PDF/IMAGE badge, preview, hover View/Download, "Uploaded"
 * footer).
 *
 * Legacy's "Upload New Document" (free-labelled extra files) is not offered:
 * this ERP's documents are a fixed set collected by the onboarding wizard,
 * and the API refuses employee uploads once onboarding is complete.
 */
export function MyDocumentsView() {
  const query = useMyDocuments();

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
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

  const docs = [...query.data].sort(
    (a, b) => ORDER.indexOf(a.documentType) - ORDER.indexOf(b.documentType),
  );
  const total = docs.length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <div className="relative overflow-hidden rounded-2xl bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan p-6 text-white shadow-xl sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 -translate-y-8 translate-x-8 opacity-10"
        >
          <Sparkles className="h-64 w-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide backdrop-blur-md">
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Employee Document Management
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              My Documents
            </h1>
            <p className="mt-1 text-sm text-white/80">
              View, manage, and download all your official verification records
              and uploaded proofs.
            </p>
          </div>
          <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-md">
            {total} {total === 1 ? "Document" : "Documents"} Available
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-gray-700 dark:border-brand-900/60 dark:bg-brand-950/20 dark:text-gray-300">
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-brand-500"
          aria-hidden="true"
        />
        <p>
          Your verification documents were collected during onboarding. To
          replace one or add another (offer letter, relieving letter,
          certificate),{" "}
          <Link
            href="/portal/tickets"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            raise a ticket
          </Link>{" "}
          and HR will update your record.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
            <CircleCheck
              className="h-5 w-5 text-emerald-600"
              aria-hidden="true"
            />
            Standard Verification Documents
          </h2>
          <span className="text-xs font-medium text-gray-500">
            {docs.length} items
          </span>
        </div>

        {docs.length === 0 ? (
          <Card className="border border-dashed p-8 text-center">
            <FolderOpen
              className="mx-auto mb-3 h-12 w-12 text-gray-400"
              aria-hidden="true"
            />
            <p className="font-semibold text-gray-700 dark:text-gray-200">
              No Standard Documents Uploaded Yet
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Please complete your Self-Onboarding form to submit your
              verification proofs.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {docs.map((doc) => (
              <DocumentCard key={doc.documentType} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
