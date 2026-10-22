"use client";

// Pipeline Stage Settings (legacy `domain/PipelineStageSettingsDialog.tsx`): create, rename,
// reorder, retire, set SLA days and win probability on pipeline stages. Won/Lost/On-Hold stages
// are structural (reached via explicit actions, not the board) and are shown read-only.
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import { Switch } from "@/components/legacy-ui/switch";
import { cn } from "@/components/legacy-ui/utils";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import type { Opportunity, PipelineStage } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { ArrowDown, ArrowUp, Plus, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  useReorderPipelineStages,
  useUpdatePipelineStage,
} from "../hooks";

export function PipelineStageSettingsDialog({
  open,
  onOpenChange,
  stages,
  opportunities,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: PipelineStage[];
  /** OPEN opportunities, used for the per-stage "N open" badge and delete guard. */
  opportunities: Opportunity[];
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newSla, setNewSla] = useState(7);
  const [busyId, setBusyId] = useState<number | null>(null);

  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const reorderStages = useReorderPipelineStages();
  const deleteStage = useDeletePipelineStage();

  const configurable = useMemo(
    () =>
      stages
        .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
        .sort((a, b) => a.order - b.order),
    [stages],
  );
  const structural = useMemo(
    () => stages.filter((s) => s.isWon || s.isLost || s.isOnHold),
    [stages],
  );

  const countInStage = (stageId: number) =>
    opportunities.filter((o) => o.status === "OPEN" && o.stageId === stageId)
      .length;

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    try {
      await createStage.mutateAsync({
        label: newLabel.trim(),
        order: configurable.length + 1,
        slaDays: newSla || 7,
      });
      toast.success("Stage added");
      setNewLabel("");
      setNewSla(7);
    } catch {
      toast.error("Failed to create stage. Please try again.");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= configurable.length) return;
    const reordered = [...configurable];
    [reordered[index], reordered[target]] = [
      reordered[target]!,
      reordered[index]!,
    ];
    setBusyId(configurable[index]!.id);
    try {
      await reorderStages.mutateAsync({
        orderedIds: reordered.map((s) => s.id),
      });
    } catch {
      toast.error("Failed to reorder stages. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const patch = async (
    stage: PipelineStage,
    input: Parameters<typeof updateStage.mutateAsync>[0]["input"],
    errorMessage: string,
  ) => {
    try {
      await updateStage.mutateAsync({ id: stage.id, input });
    } catch {
      toast.error(errorMessage);
    }
  };

  const toggleActive = async (stage: PipelineStage) => {
    setBusyId(stage.id);
    await patch(
      stage,
      { isActive: !stage.isActive },
      "Failed to update stage. Please try again.",
    );
    setBusyId(null);
  };

  const handleDelete = async (stage: PipelineStage) => {
    try {
      await deleteStage.mutateAsync(stage.id);
      toast.success(`Deleted "${stage.label}"`);
    } catch (err) {
      throw new Error(
        err instanceof ApiError ? err.message : "Failed to delete the stage.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-600" /> Configure Pipeline
            Stages
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {configurable.length === 0 ? (
            <EmptyState icon={Settings2} title="No stages configured" />
          ) : (
            <div className="space-y-2">
              {configurable.map((stage, index) => {
                const inUse = countInStage(stage.id);
                const active = stage.isActive;
                return (
                  <div
                    key={`${stage.id}-${stage.updatedAt}`}
                    className={cn(
                      "rounded-2xl border p-3 flex items-center gap-3",
                      active
                        ? "border-slate-200/80 bg-white"
                        : "border-slate-200 bg-slate-50/70 opacity-70",
                    )}
                  >
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label="Move stage up"
                        disabled={index === 0 || busyId === stage.id}
                        onClick={() => void move(index, -1)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move stage down"
                        disabled={
                          index === configurable.length - 1 ||
                          busyId === stage.id
                        }
                        onClick={() => void move(index, 1)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                      <Input
                        defaultValue={stage.label}
                        onBlur={(e) => {
                          const label = e.target.value.trim();
                          if (!label || label === stage.label) return;
                          void patch(
                            stage,
                            { label },
                            "Failed to rename stage. Please try again.",
                          );
                        }}
                        className="h-8 rounded-lg text-sm font-semibold"
                      />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          defaultValue={stage.slaDays ?? 7}
                          onBlur={(e) =>
                            void patch(
                              stage,
                              {
                                slaDays: Math.max(
                                  1,
                                  Math.round(Number(e.target.value)) || 7,
                                ),
                              },
                              "Failed to update SLA. Please try again.",
                            )
                          }
                          className="h-8 rounded-lg text-sm w-16"
                        />
                        <span className="text-xs text-slate-400">days SLA</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={stage.probability ?? 0}
                          onBlur={(e) =>
                            void patch(
                              stage,
                              {
                                probability: Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    Math.round(Number(e.target.value)) || 0,
                                  ),
                                ),
                              },
                              "Failed to update win probability. Please try again.",
                            )
                          }
                          className="h-8 rounded-lg text-sm w-16"
                        />
                        <span className="text-xs text-slate-400">
                          % win prob.
                        </span>
                      </div>
                    </div>
                    {inUse > 0 && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {inUse} open
                      </Badge>
                    )}
                    <Switch
                      checked={active}
                      onCheckedChange={() => void toggleActive(stage)}
                      disabled={busyId === stage.id}
                    />
                    <DeleteConfirmDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${stage.label}`}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                        >
                          ×
                        </Button>
                      }
                      title={`Delete "${stage.label}" stage?`}
                      description="This moves the stage to the CRM Recycle Bin. Opportunities must be moved out of it first."
                      warning={
                        inUse > 0
                          ? `${inUse} open opportunit${inUse === 1 ? "y is" : "ies are"} currently in this stage — move them to another stage before deleting.`
                          : undefined
                      }
                      onConfirm={() => handleDelete(stage)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-dashed border-slate-300 p-3 flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New stage name…"
              className="h-9 rounded-lg flex-1"
            />
            <Input
              type="number"
              min={1}
              value={newSla}
              onChange={(e) => setNewSla(Number(e.target.value) || 7)}
              className="h-9 rounded-lg w-20"
              title="SLA (days)"
            />
            <Button
              size="sm"
              className="rounded-lg gap-1.5 shrink-0"
              disabled={!newLabel.trim() || createStage.isPending}
              onClick={() => void handleCreate()}
            >
              <Plus className="h-3.5 w-3.5" /> Add Stage
            </Button>
          </div>

          {structural.length > 0 && (
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Structural stages (not editable)
              </Label>
              <div className="flex gap-2 mt-1.5">
                {structural.map((s) => (
                  <Badge key={s.id} variant="outline" className="text-xs">
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
