import { Badge } from "@/components/ui/badge";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { DISPOSITION_TONE } from "./returnHelpers";
import type { ReturnDisposition } from "@/types";

/** Badges for a return line's split dispositions (e.g. "Restock 6", "Quarantine 4"). */
export function DispositionSummary({
  breakdown,
  pending,
}: {
  breakdown: Partial<Record<ReturnDisposition, number>>;
  pending?: boolean;
}) {
  const entries = Object.entries(breakdown).filter(
    ([, q]) => (q || 0) > 0,
  ) as Array<[ReturnDisposition, number]>;
  if (entries.length === 0 && !pending) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([d, q]) => (
        <Badge key={d} variant="outline" className={DISPOSITION_TONE[d]}>
          {formatStatusLabel(d)} {q}
        </Badge>
      ))}
      {pending && (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-200 bg-amber-50"
        >
          Posting pending
        </Badge>
      )}
    </div>
  );
}
