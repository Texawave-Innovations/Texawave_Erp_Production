"use client";

import {
  CHECKPOINT_RESULTS,
  QUALITY_CONDITIONS,
  QUALITY_DISPOSITIONS,
  type QualityDisposition,
  type QualityInspection,
  type QualityInspectionItem,
} from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import {
  formatDateTime,
  formatQty,
  formatStatusLabel,
  scmStatusToken,
} from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import { useInspectionAction, useRecordItemResult } from "../hooks";

/** The detail view and its action dialogs are siblings (never nested
 * `<dialog>` elements — the native dialog's top-layer stacking breaks when
 * one is rendered inside another's open content). */
export function InspectionDetailDialog({
  insp,
  onClose,
}: {
  insp: QualityInspection | null;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState<QualityInspectionItem | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = usePermission("scm.quality.write");
  const canApprove = usePermission("scm.quality.approve");
  const action = useInspectionAction();

  function closeAll() {
    setRecording(null);
    setCancelling(false);
    onClose();
  }

  async function run(a: "start" | "cancel" | "complete", body?: object) {
    if (!insp) return;
    setErr(null);
    setBusy(true);
    try {
      await action.mutateAsync({ id: insp.id, action: a, body });
      setCancelling(false);
    } catch (e) {
      setErr(errorText(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={insp !== null}
        onClose={closeAll}
        title={insp?.inspectionNumber ?? "Inspection"}
        size="2xl"
        className="sm:max-w-5xl"
      >
        {insp ? (
          <div className="flex flex-col gap-4">
            <div>
              <StatusBadge
                label={formatStatusLabel(insp.status)}
                colorToken={scmStatusToken(insp.status)}
              />
              {insp.result ? (
                <span className="ml-2">
                  <StatusBadge
                    label={formatStatusLabel(insp.result)}
                    colorToken={scmStatusToken(insp.result)}
                  />
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Field
                label="Source"
                value={insp.sourceNumber ?? insp.sourceId}
              />
              <Field
                label="Party"
                value={insp.supplierName ?? insp.customerName}
              />
              <Field label="Warehouse" value={insp.warehouse?.name} />
              <Field label="Priority" value={insp.priority} />
              <Field label="Template" value={insp.templateName} />
              <Field label="Inspector" value={insp.inspectorName} />
              <Field label="Started" value={formatDateTime(insp.startedAt)} />
              <Field
                label="Completed"
                value={formatDateTime(insp.completedAt)}
              />
              {insp.cancellationReason ? (
                <Field
                  label="Cancellation reason"
                  value={insp.cancellationReason}
                />
              ) : null}
            </dl>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-theme-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-theme-xs text-gray-500 dark:border-gray-800">
                    <th className="p-2">Product</th>
                    <th className="p-2 text-right">Source</th>
                    <th className="p-2 text-right">Inspected</th>
                    <th className="p-2 text-right">Accepted</th>
                    <th className="p-2 text-right">Rejected</th>
                    <th className="p-2">Result</th>
                    <th className="p-2">Disposition</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {insp.items.map((i) => (
                    <tr
                      key={i.id}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                    >
                      <td className="p-2">
                        {i.productName}{" "}
                        <span className="text-gray-500">({i.productCode})</span>
                      </td>
                      <td className="p-2 text-right">
                        {formatQty(i.sourceQty)}
                      </td>
                      <td className="p-2 text-right">
                        {formatQty(i.inspectedQty)}
                      </td>
                      <td className="p-2 text-right">
                        {formatQty(i.acceptedQty)}
                      </td>
                      <td className="p-2 text-right">
                        {formatQty(i.rejectedQty)}
                      </td>
                      <td className="p-2">
                        {i.inspectionResult
                          ? formatStatusLabel(i.inspectionResult)
                          : "—"}
                      </td>
                      <td className="p-2">
                        {i.disposition ? formatStatusLabel(i.disposition) : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {insp.status === "IN_PROGRESS" && canWrite ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecording(i)}
                          >
                            Record
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {err ? (
              <p
                role="alert"
                className="text-theme-xs text-error-600 dark:text-error-400"
              >
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {insp.status === "PENDING_INSPECTION" && canWrite ? (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void run("start")}
                >
                  Start
                </Button>
              ) : null}
              {insp.status === "IN_PROGRESS" && canApprove ? (
                <Button loading={busy} onClick={() => void run("complete")}>
                  Complete
                </Button>
              ) : null}
              {["DRAFT", "PENDING_INSPECTION", "IN_PROGRESS"].includes(
                insp.status,
              ) && canWrite ? (
                <Button variant="secondary" onClick={() => setCancelling(true)}>
                  Cancel
                </Button>
              ) : null}
              <Button variant="secondary" onClick={closeAll} disabled={busy}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <RecordResultDialog
        insp={insp}
        item={recording}
        onClose={() => setRecording(null)}
      />
      <CancelDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onSubmit={(reason) => run("cancel", { reason })}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-theme-sm text-gray-900 dark:text-white/90">
        {value ?? "—"}
      </span>
    </div>
  );
}

function CancelDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Cancel Inspection" size="md">
      {open ? (
        <div className="flex flex-col gap-4">
          <Textarea
            aria-label="Reason"
            placeholder="Reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {err ? <p className="text-theme-xs text-error-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Back
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSubmit(reason.trim());
                } catch (e) {
                  setErr(errorText(e, "Action failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function RecordResultDialog({
  insp,
  item,
  onClose,
}: {
  insp: QualityInspection | null;
  item: QualityInspectionItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={item !== null && insp !== null}
      onClose={onClose}
      title={item ? `Record result — ${item.productName}` : ""}
      size="lg"
    >
      {item && insp ? (
        <RecordBody key={item.id} insp={insp} item={item} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function RecordBody({
  insp,
  item,
  onClose,
}: {
  insp: QualityInspection;
  item: QualityInspectionItem;
  onClose: () => void;
}) {
  const record = useRecordItemResult();
  const [inspected, setInspected] = useState(String(Number(item.sourceQty)));
  const [accepted, setAccepted] = useState(
    String(Number(item.acceptedQty) || Number(item.sourceQty)),
  );
  const [rejected, setRejected] = useState(
    String(Number(item.rejectedQty) || 0),
  );
  const [manualHold, setManualHold] = useState(false);
  const [condition, setCondition] = useState(item.condition ?? "");
  const [defectCode, setDefectCode] = useState(item.defectCode ?? "");
  const [defectDescription, setDefectDescription] = useState(
    item.defectDescription ?? "",
  );
  const [disposition, setDisposition] = useState(item.disposition ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [checkResults, setCheckResults] = useState<Record<string, string>>(
    Object.fromEntries(
      (insp.template?.checkpoints ?? []).map((cp) => [cp.checkpointId, "PASS"]),
    ),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await record.mutateAsync({
        inspectionId: insp.id,
        itemId: item.id,
        input: {
          inspectedQuantity: Number(inspected),
          acceptedQuantity: Number(accepted),
          rejectedQuantity: Number(rejected),
          manualHold,
          condition: condition
            ? (condition as (typeof QUALITY_CONDITIONS)[number])
            : undefined,
          defectCode: defectCode || undefined,
          defectDescription: defectDescription || undefined,
          disposition: disposition
            ? (disposition as QualityDisposition)
            : undefined,
          notes: notes || undefined,
          checkpointResults: (insp.template?.checkpoints ?? []).map((cp) => ({
            checkpointId: cp.checkpointId,
            result: (checkResults[cp.checkpointId] ??
              "PASS") as (typeof CHECKPOINT_RESULTS)[number],
          })),
        },
      });
      onClose();
    } catch (e) {
      setErr(errorText(e, "Failed to record result"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-theme-xs text-gray-500">
        Source quantity: {formatQty(item.sourceQty)}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          type="number"
          min={0}
          step={0.001}
          aria-label="Inspected quantity"
          placeholder="Inspected qty"
          value={inspected}
          onChange={(e) => setInspected(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          step={0.001}
          aria-label="Accepted quantity"
          placeholder="Accepted qty"
          value={accepted}
          onChange={(e) => setAccepted(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          step={0.001}
          aria-label="Rejected quantity"
          placeholder="Rejected qty"
          value={rejected}
          onChange={(e) => setRejected(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-theme-sm">
        <Checkbox
          checked={manualHold}
          onChange={(e) => setManualHold(e.target.checked)}
        />
        Hold for review (accepted + rejected may be less than inspected)
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          aria-label="Condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="">Condition (optional)</option>
          {QUALITY_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {formatStatusLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Disposition"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
        >
          <option value="">Disposition (required unless Pass)</option>
          {QUALITY_DISPOSITIONS.map((d) => (
            <option key={d} value={d}>
              {formatStatusLabel(d)}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Defect code"
          placeholder="Defect code (optional)"
          value={defectCode}
          onChange={(e) => setDefectCode(e.target.value.toUpperCase())}
        />
        <Input
          aria-label="Defect description"
          placeholder="Defect description (optional)"
          value={defectDescription}
          onChange={(e) => setDefectDescription(e.target.value)}
        />
      </div>
      {insp.template?.checkpoints.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          {insp.template.checkpoints.map((cp) => (
            <div
              key={cp.checkpointId}
              className="grid grid-cols-[1fr_8rem] items-center gap-3"
            >
              <span className="text-theme-sm">
                {cp.name}{" "}
                {cp.required ? <span className="text-error-500">*</span> : null}
              </span>
              <Select
                aria-label={`Checkpoint ${cp.name}`}
                value={checkResults[cp.checkpointId] ?? "PASS"}
                onChange={(e) =>
                  setCheckResults((r) => ({
                    ...r,
                    [cp.checkpointId]: e.target.value,
                  }))
                }
              >
                {CHECKPOINT_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      ) : null}
      <Textarea
        aria-label="Notes"
        placeholder="Notes (required for a High/Critical defect)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {err ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {err}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save Result
        </Button>
      </div>
    </form>
  );
}
