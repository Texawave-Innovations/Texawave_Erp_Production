"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { HrPageHeader } from "@/features/hr/components";
import {
  Building2,
  Calendar,
  Download,
  FileCheck,
  FileText,
  GraduationCap,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  downloadMyDocument,
  type DocumentRecord,
} from "@/features/onboarding/api";
import { useMyDocuments } from "@/features/onboarding/hooks";
import { useRegionalFormatter } from "@/features/settings/preferences/hooks";

const DOC_LABELS: Record<string, string> = {
  PROFILE_PHOTO: "Profile Photo",
  RESUME: "Resume / CV",
  AADHAAR: "Aadhaar Card",
  PAN: "PAN Card",
  BANK_STATEMENT: "Bank Statement / Passbook",
  CERT_10TH: "10th Standard Certificate",
  CERT_12TH: "12th Standard Certificate",
  CERT_GRADUATION: "Graduation Degree Certificate",
  CERT_POST_GRADUATION: "Post Graduation Certificate",
};

type DocCategory = "" | "IDENTITY" | "ACADEMIC" | "FINANCIAL";

const IDENTITY_TYPES = ["AADHAAR", "PAN", "PROFILE_PHOTO"];
const ACADEMIC_TYPES = [
  "CERT_10TH",
  "CERT_12TH",
  "CERT_GRADUATION",
  "CERT_POST_GRADUATION",
];
const FINANCIAL_TYPES = ["BANK_STATEMENT", "RESUME"];

function getCategory(type: string): DocCategory {
  if (IDENTITY_TYPES.includes(type)) return "IDENTITY";
  if (ACADEMIC_TYPES.includes(type)) return "ACADEMIC";
  if (FINANCIAL_TYPES.includes(type)) return "FINANCIAL";
  return "";
}

/**
 * The documents an employee uploaded during onboarding (photo, Aadhaar, PAN,
 * bank statement, certificates), with instant download.
 */
export function MyDocumentsView() {
  const query = useMyDocuments();
  const { toast } = useToast();
  const { formatDate } = useRegionalFormatter();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocCategory>("");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = query.data ?? [];

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

  // Summary counts across all documents
  const summary = useMemo(() => {
    return {
      total: rows.length,
      identity: rows.filter((r) => IDENTITY_TYPES.includes(r.documentType))
        .length,
      academic: rows.filter((r) => ACADEMIC_TYPES.includes(r.documentType))
        .length,
      financial: rows.filter((r) => FINANCIAL_TYPES.includes(r.documentType))
        .length,
    };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedCategory) {
        if (getCategory(r.documentType) !== selectedCategory) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const friendlyName = (
          DOC_LABELS[r.documentType] ?? r.documentType
        ).toLowerCase();
        const fileName = r.fileName.toLowerCase();
        if (!friendlyName.includes(q) && !fileName.includes(q)) return false;
      }
      return true;
    });
  }, [rows, selectedCategory, searchQuery]);

  const hasFilters = selectedCategory !== "" || searchQuery !== "";

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4 animate-reveal">
        <div className="h-28 w-full rounded-2xl bg-sky-100/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
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
        >
          Ask an administrator for permission to access your documents.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const metricCards = [
    {
      label: "All Documents",
      value: summary.total.toString(),
      subtext: "Verified records",
      Icon: FileCheck,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
      category: "" as DocCategory,
    },
    {
      label: "Identity & KYC",
      value: summary.identity.toString(),
      subtext: "Aadhaar, PAN, Photo",
      Icon: ShieldCheck,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
      category: "IDENTITY" as DocCategory,
    },
    {
      label: "Academic Proofs",
      value: summary.academic.toString(),
      subtext: "Degrees & Certificates",
      Icon: GraduationCap,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
      category: "ACADEMIC" as DocCategory,
    },
    {
      label: "Financial & Career",
      value: summary.financial.toString(),
      subtext: "Banking & Resume",
      Icon: Building2,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
      category: "FINANCIAL" as DocCategory,
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Page Header with 3D Documents Icon */}
      <HrPageHeader
        title="My Documents"
        description="Access, review, and download your verified onboarding documents, identity proofs, and academic records."
        icon3d="documents"
      />

      {/* 2. Interactive Category Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => {
          const isSelected = selectedCategory === card.category;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedCategory((prev) =>
                  prev === card.category ? "" : card.category,
                );
              }}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-2 border-brand-500 bg-sky-50/80 shadow-xs ring-2 ring-brand-500/15 dark:bg-slate-800"
                  : "border border-sky-200/90 bg-white hover:border-brand-300 hover:bg-sky-50/40 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
              >
                <card.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                  {card.value}
                </span>
                <span className="block text-[11px] font-medium text-slate-400 truncate">
                  {card.subtext}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Bar: Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <div className="w-full sm:w-72">
          <Input
            aria-label="Search documents"
            placeholder="Search document name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as DocCategory)}
          >
            <option value="">All categories</option>
            <option value="IDENTITY">Identity & KYC</option>
            <option value="ACADEMIC">Academic Proofs</option>
            <option value="FINANCIAL">Financial & Career</option>
          </Select>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCategory("");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Table / Content */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={hasFilters ? "No matching documents" : "No documents yet"}
            description={
              hasFilters
                ? "Try clearing the search or category filter to view all files."
                : "Documents uploaded during your onboarding verification will appear here."
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable<DocumentRecord>
            className="border-0 shadow-none rounded-none"
            columns={[
              {
                header: "Document Name",
                cell: (row) => (
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-600 dark:bg-slate-800 dark:text-sky-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-[#0a3271] dark:text-white truncate">
                        {DOC_LABELS[row.documentType] ?? row.documentType}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {row.fileName}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                header: "Category",
                cell: (row) => {
                  const cat = getCategory(row.documentType);
                  return (
                    <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                      {cat === "IDENTITY"
                        ? "Identity"
                        : cat === "ACADEMIC"
                          ? "Academic"
                          : "Financial"}
                    </span>
                  );
                },
              },
              {
                header: "Upload Date",
                cell: (row) => (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    <span>{formatDate(row.uploadedAt)}</span>
                  </div>
                ),
              },
              {
                header: "Action",
                className: "text-right",
                cell: (row) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={downloadingType === row.documentType}
                    onClick={() => void handleDownload(row)}
                    className="flex items-center gap-1.5 rounded-lg font-semibold hover:border-brand-300 hover:text-brand-600"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </Button>
                ),
              },
            ]}
            rows={filteredRows}
            getRowKey={(row) => row.documentType}
          />
        </div>
      )}
    </div>
  );
}
