// Phase 12 — renders one resolved scan result: either a single record's detail card, a
// disambiguation list when the same code matched more than one record, or a "not found" state.
// Never fabricates data — everything shown comes straight from `barcodeResolver.ts`.
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { ArrowRight, PackageSearch } from "lucide-react";
import { SCAN_TYPE_LABEL } from "../barcodeResolver";
import type { ScmScanResult } from "../barcodeTypes";

const TYPE_TONE: Record<string, string> = {
  PRODUCT: "text-brand-700 border-brand-200 bg-brand-50",
  SUPPLIER: "text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50",
  WAREHOUSE: "text-blue-600 border-blue-200 bg-blue-50",
  LOCATION: "text-sky-600 border-sky-200 bg-sky-50",
  BATCH: "text-purple-600 border-purple-200 bg-purple-50",
  SERIAL: "text-indigo-600 border-indigo-200 bg-indigo-50",
  PURCHASE_REQUISITION: "text-rose-600 border-rose-200 bg-rose-50",
  RFQ: "text-pink-600 border-pink-200 bg-pink-50",
  PURCHASE_ORDER: "text-amber-600 border-amber-200 bg-amber-50",
  GRN: "text-emerald-600 border-emerald-200 bg-emerald-50",
  SALES_ORDER: "text-teal-600 border-teal-200 bg-teal-50",
  PICK_LIST: "text-lime-600 border-lime-200 bg-lime-50",
  PACKAGE: "text-yellow-600 border-yellow-200 bg-yellow-50",
  SHIPMENT: "text-cyan-600 border-cyan-200 bg-cyan-50",
  RETURN: "text-orange-600 border-orange-200 bg-orange-50",
  QC_INSPECTION: "text-violet-600 border-violet-200 bg-violet-50",
  QUARANTINE: "text-red-600 border-red-200 bg-red-50",
  UNKNOWN: "text-muted-foreground border-border bg-muted/40",
};

export default function ScmBarcodeResult({
  result,
  onPick,
}: {
  result: ScmScanResult;
  onPick?: (r: ScmScanResult) => void;
}) {
  const navigate = useNavigate();

  if (result.alternatives && result.alternatives.length > 1) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="font-semibold">
            Multiple matches for "{result.code}"
          </div>
          <div className="text-sm text-muted-foreground">
            This code matches more than one record — select which one you meant.
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.alternatives.map((alt, idx) => (
            <button
              key={idx}
              className="w-full text-left border rounded-md p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
              onClick={() => onPick?.(alt)}
            >
              <div className="min-w-0">
                <Badge variant="outline" className={TYPE_TONE[alt.type]}>
                  {SCAN_TYPE_LABEL[alt.type]}
                </Badge>
                <div className="font-medium mt-1 truncate">{alt.title}</div>
                {alt.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">
                    {alt.subtitle}
                  </div>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (result.type === "UNKNOWN") {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <PackageSearch className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-medium text-foreground">
            No SCM record found for this barcode.
          </div>
          <div className="text-sm text-muted-foreground mt-1 font-mono">
            {result.code}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className={TYPE_TONE[result.type]}>
            {SCAN_TYPE_LABEL[result.type]}
          </Badge>
          <div className="text-lg font-semibold mt-1 truncate">
            {result.title}
          </div>
          {result.subtitle && (
            <div className="text-sm text-muted-foreground truncate">
              {result.subtitle}
            </div>
          )}
        </div>
        {result.viewPath && (
          <Button
            size="sm"
            onClick={() => navigate(result.viewPath!)}
            className="shrink-0"
          >
            {result.viewLabel || "View"}{" "}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {result.fields.map((f) => (
            <div
              key={f.label}
              className="flex justify-between border-b border-border/60 py-1.5 sm:border-none sm:py-0 sm:block"
            >
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium sm:ml-2">{f.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
