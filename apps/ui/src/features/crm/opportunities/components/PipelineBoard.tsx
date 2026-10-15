"use client";

import type { Opportunity, PipelineStage } from "@texawave-erp/api-types";
import {
  ApiError,
  createPipelineStageSchema,
  type CreateOpportunityFormValues,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  cn,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { MoveStageDialog } from "./OpportunityActionDialogs";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { OpportunityForm } from "./OpportunityForm";
import {
  useCreatePipelineStage,
  usePipelineStages,
} from "../../pipeline-stages/hooks";
import { useCreateOpportunity, useOpportunities } from "../hooks";

const PAGE_SIZE = 50;

/**
 * Reproduces legacy Pipeline.tsx: a Kanban/List toggle, stage columns with
 * a count badge, drag-and-drop between columns (always confirmed with
 * required remarks — see MoveStageDialog), and a card showing title,
 * account, estimated value, priority, and expected revenue
 * (estimatedValue × probability). The SLA "health" dot, "days in stage"
 * badge, and "next action overdue" badge are deferred UI polish — the
 * underlying data (`stageEnteredAt`, `slaDays`) is already tracked, just
 * not yet rendered.
 */
export function PipelineBoard() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageOpen, setCreateStageOpen] = useState(false);
  const [active, setActive] = useState<Opportunity | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    opportunity: Opportunity;
    stage: PipelineStage;
  } | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const { toast } = useToast();

  const stagesQuery = usePipelineStages();
  const opportunitiesQuery = useOpportunities({
    page,
    limit: PAGE_SIZE,
    q: search || undefined,
  });
  const createMutation = useCreateOpportunity();
  const createStageMutation = useCreatePipelineStage();

  async function handleCreate(values: CreateOpportunityFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({ title: "Deal created", variant: "success" });
  }

  if (stagesQuery.isPending || opportunitiesQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (stagesQuery.isError || opportunitiesQuery.isError) {
    const err = stagesQuery.error ?? opportunitiesQuery.error;
    if (err instanceof ApiError && err.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to the Pipeline">
          Ask an administrator for the <code>crm.opportunity.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return (
      <ErrorState
        onRetry={() => {
          void stagesQuery.refetch();
          void opportunitiesQuery.refetch();
        }}
      />
    );
  }

  const stages = stagesQuery.data ?? [];
  const boardStages = stages
    .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);
  const opportunities = opportunitiesQuery.data.data;
  const byStage = new Map<number, Opportunity[]>();
  for (const o of opportunities) {
    byStage.set(o.stageId, [...(byStage.get(o.stageId) ?? []), o]);
  }

  function handleDragStart(event: React.DragEvent, opportunity: Opportunity) {
    event.dataTransfer.setData("text/plain", String(opportunity.id));
  }

  function handleDrop(event: React.DragEvent, stage: PipelineStage) {
    event.preventDefault();
    setDragOverStageId(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    const opportunity = opportunities.find((o) => o.id === id);
    if (!opportunity || opportunity.stageId === stage.id) return;
    setPendingMove({ opportunity, stage });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Pipeline
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreateStageOpen(true)}>
            Add Stage
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Add Deal</Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search title, owner, account..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={cn(
              "rounded-md px-3 py-1 text-theme-sm",
              view === "kanban"
                ? "bg-brand-500 text-white"
                : "text-gray-600 dark:text-gray-400",
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "rounded-md px-3 py-1 text-theme-sm",
              view === "list"
                ? "bg-brand-500 text-white"
                : "text-gray-600 dark:text-gray-400",
            )}
          >
            List
          </button>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <EmptyState
            title="No deals yet"
            description="Create your first deal to see it here."
          />
        </Card>
      ) : view === "list" ? (
        <>
          <DataTable<Opportunity>
            columns={[
              { header: "Title", cell: (o) => o.title },
              { header: "Account", cell: (o) => o.account.name },
              { header: "Owner", cell: (o) => o.ownerName },
              { header: "Stage", cell: (o) => o.stage.label },
              {
                header: "Status",
                cell: (o) => (
                  <StatusBadge
                    label={o.status.replace("_", " ")}
                    colorToken={statusColor(o.status)}
                  />
                ),
              },
              {
                header: "Value",
                cell: (o) => `${o.currency ?? "INR"} ${o.estimatedValue}`,
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (o) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActive(o)}
                  >
                    View
                  </Button>
                ),
              },
            ]}
            rows={opportunities}
            getRowKey={(o) => String(o.id)}
          />
          <Pagination
            page={opportunitiesQuery.data.meta.page}
            totalPages={opportunitiesQuery.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {boardStages.map((stage) => {
              const cards = byStage.get(stage.id) ?? [];
              const isDragOver = dragOverStageId === stage.id;
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStageId(stage.id);
                  }}
                  onDragLeave={() =>
                    setDragOverStageId((s) => (s === stage.id ? null : s))
                  }
                  onDrop={(e) => handleDrop(e, stage)}
                  className={cn(
                    "w-72 shrink-0 rounded-2xl border bg-gray-50 flex flex-col max-h-[70vh] transition-colors dark:bg-gray-900",
                    isDragOver
                      ? "border-brand-400 bg-brand-50 dark:bg-brand-950/30"
                      : "border-gray-200 dark:border-gray-800",
                  )}
                >
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <p className="text-theme-xs font-bold uppercase tracking-wide text-gray-500">
                      {stage.label}
                    </p>
                    <span className="text-theme-xs rounded-full bg-gray-200 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {cards.length === 0 ? (
                      <p className="text-theme-xs text-gray-400 text-center py-6">
                        No deals
                      </p>
                    ) : (
                      cards.map((o) => {
                        const probability =
                          o.probability ?? stage.probability ?? 0;
                        const expectedRevenue =
                          (Number(o.estimatedValue) * probability) / 100;
                        return (
                          <div
                            key={o.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, o)}
                            onClick={() => setActive(o)}
                            className="rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:shadow-md transition-shadow dark:border-gray-800 dark:bg-gray-dark"
                          >
                            <p className="text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
                              {o.title}
                            </p>
                            <p className="text-theme-xs text-gray-500 mt-1 truncate">
                              {o.account.name}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
                                {o.currency ?? "INR"} {o.estimatedValue}
                              </span>
                              {o.priority ? (
                                <StatusBadge
                                  label={o.priority}
                                  colorToken="gray"
                                />
                              ) : null}
                            </div>
                            <p className="text-theme-xs text-brand-600 font-medium mt-1 dark:text-brand-400">
                              Expected {o.currency ?? "INR"}{" "}
                              {expectedRevenue.toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OpportunityDrawer
        opportunity={active}
        stages={stages}
        open={active !== null}
        onClose={() => setActive(null)}
      />

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New deal"
      >
        <OpportunityForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create deal"
        />
      </Dialog>

      <Dialog
        open={createStageOpen}
        onClose={() => setCreateStageOpen(false)}
        title="New pipeline stage"
      >
        <CreateStageForm
          onCancel={() => setCreateStageOpen(false)}
          onSubmit={async (values) => {
            await createStageMutation.mutateAsync(values);
            setCreateStageOpen(false);
            toast({ title: "Stage created", variant: "success" });
          }}
        />
      </Dialog>

      {pendingMove ? (
        <Dialog open onClose={() => setPendingMove(null)} title="Move deal">
          <MoveStageDialog
            opportunity={pendingMove.opportunity}
            targetStage={pendingMove.stage}
            onDone={() => setPendingMove(null)}
            onCancel={() => setPendingMove(null)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

function statusColor(
  status: string,
): "brand" | "gray" | "success" | "warning" | "error" {
  if (status === "WON") return "success";
  if (status === "LOST") return "error";
  if (status === "ON_HOLD") return "warning";
  return "brand";
}

function CreateStageForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (values: { label: string }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createPipelineStageSchema.safeParse({ label });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid label");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ label });
    } catch {
      setError("Could not create this stage.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Label" required error={error ?? undefined}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Create
        </Button>
      </div>
    </form>
  );
}
