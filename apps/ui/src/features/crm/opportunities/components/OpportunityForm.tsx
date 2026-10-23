"use client";

import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import {
  OPPORTUNITY_PRIORITIES,
  createOpportunitySchema,
  type CreateOpportunityFormValues,
} from "@texawave-erp/core";
import { useState } from "react";
import { AccountPicker } from "../../accounts/components/AccountPicker";
import { usePipelineStages } from "../../pipeline-stages/hooks";

export interface OpportunityFormProps {
  initialValues?: Partial<CreateOpportunityFormValues> | undefined;
  onSubmit: (values: CreateOpportunityFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** "New Deal" form (Account, Title, Owner, Estimated Value required; stage, expected close,
 * priority, campaign source, contact role optional) in the legacy CRM form style. */
export function OpportunityForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: OpportunityFormProps) {
  const [accountId, setAccountId] = useState<number | undefined>(
    initialValues?.accountId,
  );
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [ownerName, setOwnerName] = useState(initialValues?.ownerName ?? "");
  const [stageId, setStageId] = useState<number | undefined>(
    initialValues?.stageId,
  );
  const [estimatedValue, setEstimatedValue] = useState(
    initialValues?.estimatedValue !== undefined
      ? String(initialValues.estimatedValue)
      : "",
  );
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    initialValues?.expectedCloseDate ?? "",
  );
  const [priority, setPriority] = useState<string>(
    initialValues?.priority ?? "",
  );
  const [campaignSource, setCampaignSource] = useState(
    initialValues?.campaignSource ?? "",
  );
  const [contactRole, setContactRole] = useState(
    initialValues?.contactRole ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stagesQuery = usePipelineStages();
  const boardStages = (stagesQuery.data ?? [])
    .filter((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createOpportunitySchema.safeParse({
      accountId,
      title,
      ownerName,
      stageId,
      estimatedValue:
        estimatedValue === "" ? undefined : Number(estimatedValue),
      expectedCloseDate: expectedCloseDate || undefined,
      priority: priority || undefined,
      campaignSource: campaignSource || undefined,
      contactRole: contactRole || undefined,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError(
        "Could not save this deal. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const err = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-600">Account *</Label>
        <AccountPicker value={accountId} onChange={setAccountId} />
        {err("accountId")}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-600">Deal Title *</Label>
        <Input
          className="h-9 rounded-xl"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {err("title")}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">Owner *</Label>
          <Input
            className="h-9 rounded-xl"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          {err("ownerName")}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">
            Estimated Value *
          </Label>
          <Input
            className="h-9 rounded-xl"
            type="number"
            min={0}
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
          />
          {err("estimatedValue")}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">Stage *</Label>
          <Select
            value={stageId ? String(stageId) : ""}
            onValueChange={(v) => setStageId(Number(v))}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Select a stage" />
            </SelectTrigger>
            <SelectContent>
              {boardStages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("stageId")}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("priority")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-600">
          Expected Close Date
        </Label>
        <DatePicker
          value={expectedCloseDate}
          onChange={setExpectedCloseDate}
          className="h-9"
        />
        {err("expectedCloseDate")}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">
            Campaign Source
          </Label>
          <Input
            className="h-9 rounded-xl"
            value={campaignSource}
            onChange={(e) => setCampaignSource(e.target.value)}
          />
          {err("campaignSource")}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">
            Contact Role
          </Label>
          <Input
            className="h-9 rounded-xl"
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
          />
          {err("contactRole")}
        </div>
      </div>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
