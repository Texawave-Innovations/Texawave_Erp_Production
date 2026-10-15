// CRM Core Domain — Pipeline Stage Settings. Lets a CRM Admin / Sales Head create, rename,
// reorder, retire, and set an SLA (days) on pipeline stages, backed by the new Firebase-backed
// `crm/pipelineStages` collection (see `pipelineStagesService.ts`). Won/Lost stages are structural
// (reached via explicit Won/Lost actions, not the board) and are shown read-only here.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeleteConfirmDialog, EmptyState } from "../intelligence/components";
import { PipelineStageDef } from "./config";
import {
  createPipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  updatePipelineStage,
} from "./pipelineStagesService";
import { CrmOpportunity } from "./types";
import { useAuth } from "@/context/AuthContext";
import { isCrmAdmin } from "./roles";

export function PipelineStageSettingsDialog({
  open,
  onOpenChange,
  stages,
  opportunities,
  currentUser,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: PipelineStageDef[];
  opportunities: CrmOpportunity[];
  currentUser: string;
}) {
  const { user } = useAuth();
  const [newLabel, setNewLabel] = useState("");
  const [newSla, setNewSla] = useState(7);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const configurable = useMemo(
    () =>
      stages
        .filter((s) => !s.isWon && !s.isLost)
        .sort((a, b) => a.order - b.order),
    [stages],
  );
  const structural = useMemo(
    () => stages.filter((s) => s.isWon || s.isLost),
    [stages],
  );

  const countInStage = (stageId: string) =>
    opportunities.filter((o) => o.status === "OPEN" && o.stage === stageId)
      .length;

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      await createPipelineStage(
        {
          label: newLabel.trim(),
          order: configurable.length + 1,
          slaDays: newSla || 7,
        },
        currentUser,
      );
      toast.success("Stage added");
      setNewLabel("");
      setNewSla(7);
    } catch (err) {
      console.error("Failed to create pipeline stage:", err);
      toast.error("Failed to create stage. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= configurable.length) return;
    const reordered = [...configurable];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    setBusyId(configurable[index].id);
    try {
      await reorderPipelineStages(reordered.map((s) => s.id));
    } catch (err) {
      console.error("Failed to reorder pipeline stages:", err);
      toast.error("Failed to reorder stages. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (stage: PipelineStageDef) => {
    setBusyId(stage.id);
    try {
      await updatePipelineStage(stage.id, { active: !(stage.active ?? true) });
    } catch (err) {
      console.error("Failed to update pipeline stage:", err);
      toast.error("Failed to update stage. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const updateSla = async (stage: PipelineStageDef, slaDays: number) => {
    try {
      await updatePipelineStage(stage.id, { slaDays });
    } catch (err) {
      console.error("Failed to update stage SLA:", err);
      toast.error("Failed to update SLA. Please try again.");
    }
  };

  const updateProbability = async (
    stage: PipelineStageDef,
    probability: number,
  ) => {
    try {
      await updatePipelineStage(stage.id, { probability });
    } catch (err) {
      console.error("Failed to update stage probability:", err);
      toast.error("Failed to update win probability. Please try again.");
    }
  };

  const renameStage = async (stage: PipelineStageDef, label: string) => {
    if (!label.trim() || label === stage.label) return;
    try {
      await updatePipelineStage(stage.id, { label: label.trim() });
    } catch (err) {
      console.error("Failed to rename pipeline stage:", err);
      toast.error("Failed to rename stage. Please try again.");
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
                const active = stage.active ?? true;
                return (
                  <div
                    key={stage.id}
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
                        disabled={index === 0 || busyId === stage.id}
                        onClick={() => move(index, -1)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={
                          index === configurable.length - 1 ||
                          busyId === stage.id
                        }
                        onClick={() => move(index, 1)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                      <Input
                        defaultValue={stage.label}
                        onBlur={(e) => renameStage(stage, e.target.value)}
                        className="h-8 rounded-lg text-sm font-semibold"
                      />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          defaultValue={stage.slaDays ?? 7}
                          onBlur={(e) =>
                            updateSla(
                              stage,
                              Math.max(1, Number(e.target.value) || 7),
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
                            updateProbability(
                              stage,
                              Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
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
                      onCheckedChange={() => toggleActive(stage)}
                      disabled={busyId === stage.id}
                    />
                    {isCrmAdmin(user) && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
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
                        onConfirm={() =>
                          deletePipelineStage(
                            stage.id,
                            inUse,
                            user,
                            stage.label,
                          )
                        }
                      />
                    )}
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
              disabled={!newLabel.trim() || creating}
              onClick={handleCreate}
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
