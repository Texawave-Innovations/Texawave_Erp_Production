import { useEffect, useMemo, useState } from "react";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import {
  ALLOWED_DISPOSITIONS_BY_RESULT,
  CHECKPOINT_RESULTS,
  QUALITY_CONDITIONS,
  RESULT_TONE,
  deriveItemResult,
} from "./qualityHelpers";
import type { RecordItemResultInput } from "./inspectionService";
import type {
  ScmQualityCheckpointResult,
  ScmQualityCheckpointResultStatus,
  ScmQualityCondition,
  ScmQualityDefect,
  ScmQualityDisposition,
  ScmQualityInspectionItem,
  ScmQualityTemplate,
} from "@/types";

const NO_DEFECT = "__none__";

export function RecordItemResultDialog({
  item,
  template,
  defects,
  busy,
  onClose,
  onSave,
}: {
  item: ScmQualityInspectionItem | null;
  template: ScmQualityTemplate | null;
  defects: ScmQualityDefect[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: RecordItemResultInput) => void;
}) {
  const [inspectedQty, setInspectedQty] = useState("");
  const [acceptedQty, setAcceptedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [manualHold, setManualHold] = useState(false);
  const [condition, setCondition] = useState<ScmQualityCondition | "">("");
  const [defectCode, setDefectCode] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [disposition, setDisposition] = useState<ScmQualityDisposition | "">(
    "",
  );
  const [notes, setNotes] = useState("");
  const [checkpointResults, setCheckpointResults] = useState<
    Record<string, ScmQualityCheckpointResult>
  >({});

  useEffect(() => {
    if (!item) return;
    setInspectedQty(String(item.inspectedQuantity || item.sourceQuantity));
    setAcceptedQty(String(item.acceptedQuantity || ""));
    setRejectedQty(String(item.rejectedQuantity || ""));
    setManualHold(item.inspectionResult === "HOLD");
    setCondition(item.condition || "");
    setDefectCode(item.defectCode || "");
    setDefectDescription(item.defectDescription || "");
    setDisposition(item.disposition || "");
    setNotes(item.notes || "");
    setCheckpointResults(
      Object.fromEntries(
        (item.checkpointResults || []).map((c) => [c.checkpointId, c]),
      ),
    );
  }, [item]);

  const derivedResult = useMemo(() => {
    try {
      return deriveItemResult(
        Number(acceptedQty) || 0,
        Number(rejectedQty) || 0,
        Number(inspectedQty) || 0,
        manualHold,
      );
    } catch {
      return null;
    }
  }, [acceptedQty, rejectedQty, inspectedQty, manualHold]);

  const checkpoints = useMemo(
    () =>
      [...(template?.checkpoints || [])].sort(
        (a, b) => a.sequence - b.sequence,
      ),
    [template],
  );

  const save = () =>
    onSave({
      inspectedQuantity: Number(inspectedQty) || 0,
      acceptedQuantity: Number(acceptedQty) || 0,
      rejectedQuantity: Number(rejectedQty) || 0,
      manualHold,
      condition: condition || undefined,
      defectCode: defectCode || undefined,
      defectDescription: defectDescription || undefined,
      disposition:
        disposition &&
        derivedResult &&
        ALLOWED_DISPOSITIONS_BY_RESULT[derivedResult].includes(disposition)
          ? disposition
          : undefined,
      notes: notes || undefined,
      checkpointResults: checkpoints
        .map((c) => checkpointResults[c.checkpointId])
        .filter((c): c is ScmQualityCheckpointResult => !!c),
    });

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Result — {item?.productNameSnapshot}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Inspected Qty *</Label>
              <Input
                type="number"
                min="0"
                max={item?.sourceQuantity}
                value={inspectedQty}
                onChange={(e) => setInspectedQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Accepted Qty</Label>
              <Input
                type="number"
                min="0"
                value={acceptedQty}
                onChange={(e) => setAcceptedQty(e.target.value)}
                disabled={manualHold}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rejected Qty</Label>
              <Input
                type="number"
                min="0"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(e.target.value)}
                disabled={manualHold}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="manualHold"
              checked={manualHold}
              onCheckedChange={(v) => setManualHold(!!v)}
            />
            <Label htmlFor="manualHold" className="cursor-pointer">
              Put this line on hold (the inspected quantity is quarantined
              pending review)
            </Label>
          </div>
          {derivedResult && (
            <div className="text-xs text-muted-foreground">
              Result:{" "}
              <Badge variant="outline" className={RESULT_TONE[derivedResult]}>
                {formatStatusLabel(derivedResult)}
              </Badge>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as ScmQualityCondition)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {formatStatusLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Defect</Label>
            <Select
              value={defectCode || NO_DEFECT}
              onValueChange={(v) => setDefectCode(v === NO_DEFECT ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No defect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFECT}>No defect</SelectItem>
                {defects
                  .filter((d) => d.active)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.defectCode}>
                      {d.defectCode} — {d.name} ({d.severity})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {defectCode && (
            <div className="space-y-1.5">
              <Label>Defect Notes</Label>
              <Textarea
                value={defectDescription}
                onChange={(e) => setDefectDescription(e.target.value)}
              />
            </div>
          )}

          {derivedResult && (
            <div className="space-y-1.5">
              <Label>Disposition {derivedResult !== "PASS" ? "*" : ""}</Label>
              <Select
                value={disposition}
                onValueChange={(v) =>
                  setDisposition(v as ScmQualityDisposition)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_DISPOSITIONS_BY_RESULT[derivedResult].map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatStatusLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {checkpoints.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label>Checkpoints</Label>
              {checkpoints.map((cp) => (
                <div
                  key={cp.checkpointId}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="flex-1">
                    {cp.name}
                    {cp.required && <span className="text-red-500"> *</span>}
                  </span>
                  <Select
                    value={checkpointResults[cp.checkpointId]?.result || ""}
                    onValueChange={(v) =>
                      setCheckpointResults((m) => ({
                        ...m,
                        [cp.checkpointId]: {
                          checkpointId: cp.checkpointId,
                          name: cp.name,
                          required: cp.required,
                          result: v as ScmQualityCheckpointResultStatus,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHECKPOINT_RESULTS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Notes {defectCode ? "(required for HIGH/CRITICAL defects)" : ""}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || !derivedResult} onClick={save}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
