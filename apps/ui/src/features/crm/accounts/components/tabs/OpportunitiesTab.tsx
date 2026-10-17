"use client";

import type { Opportunity, PipelineStage } from "@texawave-erp/api-types";
import { ArrowLeft, Briefcase, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { celebrateCrm } from "@/features/crm/celebration";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { OpportunityDrawer } from "@/features/crm/opportunities/components/OpportunityDrawer";
import { useCreateOpportunity } from "@/features/crm/opportunities/hooks";
import { usePipelineStages } from "@/features/crm/pipeline-stages/hooks";
import {
  formatRupees,
  FormRow,
  InlineFormPanel,
  SectionShell,
  TABLE_HEAD_STYLE,
  TH_CLASS,
} from "../accountUi";

const DAY_MS = 86_400_000;
const STUCK_THRESHOLD_DAYS = { delayed: 7, critical: 14 };

/** Port of legacy `computeOpportunityHealth` (stage SLA, falling back to 7/14 days). */
export function opportunityHealth(
  stageEnteredAt: string,
  status: string,
  slaDays: number | null | undefined,
): "Healthy" | "Delayed" | "Critical" {
  if (status !== "OPEN") return "Healthy";
  const ageDays = (Date.now() - new Date(stageEnteredAt).getTime()) / DAY_MS;
  const delayed = slaDays ?? STUCK_THRESHOLD_DAYS.delayed;
  const critical = slaDays ? slaDays * 2 : STUCK_THRESHOLD_DAYS.critical;
  if (ageDays >= critical) return "Critical";
  if (ageDays >= delayed) return "Delayed";
  return "Healthy";
}

function OpportunityInlineForm({
  accountId,
  currentUser,
  stages,
  onCancel,
  onSaved,
}: {
  accountId: number;
  currentUser: string;
  stages: PipelineStage[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateOpportunity();
  const boardStages = useMemo(
    () =>
      stages
        .filter((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold)
        .sort((a, b) => a.order - b.order),
    [stages],
  );
  const [form, setForm] = useState({
    title: "",
    ownerName: currentUser,
    stageId: boardStages[0] ? String(boardStages[0].id) : "",
    estimatedValue: "0",
    expectedCloseDate: "",
    probability: "10",
    priority: "Medium",
    nextAction: "",
    nextActionDate: "",
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.stageId) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        accountId,
        title: form.title.trim(),
        ownerName: form.ownerName.trim() || currentUser,
        stageId: Number(form.stageId),
        estimatedValue: Number(form.estimatedValue) || 0,
        expectedCloseDate: form.expectedCloseDate || undefined,
        probability: Math.min(100, Math.max(0, Number(form.probability) || 0)),
        priority: form.priority,
        nextAction: form.nextAction.trim() || undefined,
        nextActionDate: form.nextActionDate || undefined,
      });
      celebrateCrm("deal.created");
      onSaved();
    } catch {
      toast.error("Failed to create opportunity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={Briefcase}
      title="New Opportunity"
      subtitle="Start tracking a deal through the pipeline."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Create Opportunity"
      saving={saving}
      canSubmit={Boolean(form.title.trim() && form.stageId)}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Title" required className="md:col-span-2">
          <Input
            className="h-9 rounded-xl"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Bulk fabric order — Q3"
          />
        </FormRow>
        <FormRow label="Owner">
          <Input
            className="h-9 rounded-xl"
            value={form.ownerName}
            onChange={(e) => set("ownerName", e.target.value)}
          />
        </FormRow>
        <FormRow label="Stage">
          <Select value={form.stageId} onValueChange={(v) => set("stageId", v)}>
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boardStages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Estimated Value (₹)">
          <Input
            className="h-9 rounded-xl"
            type="number"
            min={0}
            value={form.estimatedValue}
            onChange={(e) => set("estimatedValue", e.target.value)}
          />
        </FormRow>
        <FormRow label="Expected Close Date">
          <DatePicker
            className="h-9"
            value={form.expectedCloseDate}
            onChange={(v) => set("expectedCloseDate", v)}
          />
        </FormRow>
        <FormRow label="Probability (%)">
          <Input
            className="h-9 rounded-xl"
            type="number"
            min={0}
            max={100}
            value={form.probability}
            onChange={(e) => set("probability", e.target.value)}
          />
        </FormRow>
        <FormRow label="Priority">
          <Select
            value={form.priority}
            onValueChange={(v) => set("priority", v)}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Next Action">
          <Input
            className="h-9 rounded-xl"
            value={form.nextAction}
            onChange={(e) => set("nextAction", e.target.value)}
          />
        </FormRow>
        <FormRow label="Next Action Date">
          <DatePicker
            className="h-9"
            value={form.nextActionDate}
            onChange={(v) => set("nextActionDate", v)}
          />
        </FormRow>
      </div>
    </InlineFormPanel>
  );
}

export function OpportunitiesTab({
  accountId,
  currentUser,
  opportunities,
}: {
  accountId: number;
  currentUser: string;
  opportunities: Opportunity[];
}) {
  const [adding, setAdding] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = opportunities.find((o) => o.id === activeId) ?? null;
  const stagesQuery = usePipelineStages();
  const stages = stagesQuery.data ?? [];

  if (active) {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 -ml-2"
          onClick={() => setActiveId(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Opportunities
        </Button>
        <OpportunityDrawer
          opportunity={active}
          accountName={active.account.name}
          currentUser={currentUser}
          open
          onOpenChange={(o) => !o && setActiveId(null)}
          renderAs="page"
        />
      </div>
    );
  }

  if (adding) {
    return (
      <OpportunityInlineForm
        accountId={accountId}
        currentUser={currentUser}
        stages={stages}
        onCancel={() => setAdding(false)}
        onSaved={() => setAdding(false)}
      />
    );
  }

  return (
    <SectionShell
      title="Opportunities"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> New Opportunity
        </Button>
      }
    >
      {opportunities.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No opportunities yet"
          description="Create one to start tracking a deal through the pipeline."
        />
      ) : (
        <Table>
          <TableHeader className="text-white">
            <TableRow
              className="hover:bg-transparent border-none"
              style={TABLE_HEAD_STYLE}
            >
              <TableHead className={TH_CLASS}>Title</TableHead>
              <TableHead className={TH_CLASS}>Stage</TableHead>
              <TableHead className={TH_CLASS}>Value</TableHead>
              <TableHead className={TH_CLASS}>Close Date</TableHead>
              <TableHead className={TH_CLASS}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((o) => {
              const health = opportunityHealth(
                o.stageEnteredAt,
                o.status,
                o.stage.slaDays,
              );
              return (
                <TableRow
                  key={o.id}
                  className="cursor-pointer border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                  onClick={() => setActiveId(o.id)}
                >
                  <TableCell className="font-semibold text-slate-700 text-base py-1">
                    {o.title}
                    {o.opportunityNumber && (
                      <span className="block text-sm text-slate-900 font-normal">
                        {o.opportunityNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-base text-slate-900 py-1">
                    {o.stage.label}
                  </TableCell>
                  <TableCell className="text-base text-slate-900 py-1">
                    {formatRupees(o.estimatedValue)}
                  </TableCell>
                  <TableCell className="text-base text-slate-900 py-1">
                    {o.expectedCloseDate || "—"}
                  </TableCell>
                  <TableCell className="text-base py-1">
                    <Badge variant="outline" className="text-xs">
                      {o.status}
                    </Badge>
                    {o.status === "OPEN" && health !== "Healthy" && (
                      <Badge variant="warning" className="text-xs ml-1">
                        {health}
                      </Badge>
                    )}
                    {o.competitor && (
                      <span className="block text-sm text-slate-900 mt-1">
                        vs. {o.competitor}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </SectionShell>
  );
}
