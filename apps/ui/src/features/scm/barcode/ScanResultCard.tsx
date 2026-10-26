"use client";

import type { ScanResult } from "@texawave-erp/api-types";
import { Button, Card, StatusBadge } from "@texawave-erp/ui-kit";
import { ExternalLink, PackagePlus, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatStatusLabel } from "../shared/format";

const TYPE_LABEL: Record<string, string> = {
  PURCHASE_REQUISITION: "Material Requisition",
  QC_INSPECTION: "QC Inspection",
  PICK_LIST: "Pick List",
};

const typeLabel = (t: string) => TYPE_LABEL[t] ?? formatStatusLabel(t);

/** The outcome of one scan: what it is, the key facts, a link to the full
 * record, follow-up actions — and, when one code matched several records,
 * a list to pick from. An unmatched code offers to create a product. */
export function ScanResultCard({
  result,
  onPick,
  onAddProduct,
}: {
  result: ScanResult;
  onPick: (r: ScanResult) => void;
  onAddProduct: (code: string) => void;
}) {
  const router = useRouter();

  if (result.alternatives && result.alternatives.length > 1) {
    return (
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <h2 className="text-theme-sm font-semibold">
            {result.alternatives.length} records match &ldquo;{result.code}
            &rdquo;
          </h2>
          <p className="text-theme-xs text-gray-500">Pick the one you meant.</p>
          <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {result.alternatives.map((alt, i) => (
              <button
                key={`${alt.type}-${alt.title}-${i}`}
                type="button"
                onClick={() => onPick({ ...alt, alternatives: undefined })}
                className="flex items-center justify-between gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span className="text-theme-sm">
                  <span className="font-medium">{alt.title}</span>
                  {alt.subtitle ? (
                    <span className="ml-2 text-gray-500">{alt.subtitle}</span>
                  ) : null}
                </span>
                <StatusBadge label={typeLabel(alt.type)} colorToken="brand" />
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (result.type === "UNKNOWN") {
    return (
      <Card>
        <div className="flex flex-col items-start gap-3 p-4">
          <div className="flex items-center gap-2 text-theme-sm font-semibold">
            <SearchX className="h-4 w-4 text-warning-600" />
            {result.title}
          </div>
          <p className="text-theme-sm text-gray-500">
            {result.subtitle}{" "}
            {result.code ? (
              <>
                Scanned: <span className="font-mono">{result.code}</span>
              </>
            ) : null}
          </p>
          {result.code ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAddProduct(result.code)}
            >
              <PackagePlus className="mr-1.5 h-3.5 w-3.5" /> Add as new product
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge label={typeLabel(result.type)} colorToken="brand" />
              <h2 className="text-theme-md font-semibold">{result.title}</h2>
            </div>
            {result.subtitle ? (
              <p className="mt-0.5 text-theme-sm text-gray-500">
                {result.subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {result.viewPath ? (
              <Button
                size="sm"
                onClick={() => router.push(result.viewPath as string)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {result.viewLabel ?? "View"}
              </Button>
            ) : null}
            {(result.actions ?? []).map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant="secondary"
                onClick={() => router.push(a.path)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {result.fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-theme-xs uppercase tracking-wide text-gray-500">
                {f.label}
              </dt>
              <dd className="break-words text-theme-sm text-gray-900 dark:text-white/90">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
