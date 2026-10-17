"use client";

import type { ConvertLeadInput, Lead } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/legacy-ui/button";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/legacy-ui/select";
import { celebrateCrm } from "@/features/crm/celebration";
import { DatePicker } from "@/features/crm/legacy-ui/DatePicker";
import { AccountPicker } from "../../accounts/components/AccountPicker";
import { useAccount } from "../../accounts/hooks";
import { usePipelineStages } from "../../pipeline-stages/hooks";
import { useConvertLead } from "../hooks";

export interface LeadConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onConverted?: ((lead: Lead) => void) | undefined;
  /** Navigate to the new Account after converting (default true, like the
   * Leads list; the Lead detail page passes false and stays put). */
  navigateToAccountOnSuccess?: boolean | undefined;
}

/** Legacy `domain/LeadConvertDialog.tsx`: Lead -> Account / Contact / optional
 * Deal. Wired to `POST /crm/leads/:id/convert`; duplicate-account detection is
 * done server-side (`DUPLICATE_ACCOUNT`) and surfaces as the legacy "Create
 * anyway" warning. */
export function LeadConvertDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
  navigateToAccountOnSuccess = true,
}: LeadConvertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <ConvertForm
          lead={lead}
          onClose={() => onOpenChange(false)}
          onConverted={onConverted}
          navigateToAccountOnSuccess={navigateToAccountOnSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConvertForm({
  lead,
  onClose,
  onConverted,
  navigateToAccountOnSuccess,
}: {
  lead: Lead;
  onClose: () => void;
  onConverted: ((lead: Lead) => void) | undefined;
  navigateToAccountOnSuccess: boolean;
}) {
  const router = useRouter();
  const stagesQuery = usePipelineStages();
  const boardStages = (stagesQuery.data ?? [])
    .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);
  const convertMutation = useConvertLead();

  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [existingAccountId, setExistingAccountId] = useState("");
  const existingAccountQuery = useAccount(
    existingAccountId ? Number(existingAccountId) : undefined,
  );
  const [contactName, setContactName] = useState(lead.prospectName);
  const [contactTitle, setContactTitle] = useState(lead.title ?? "");
  const [contactEmail, setContactEmail] = useState(lead.email ?? "");
  const [contactPhone, setContactPhone] = useState(
    lead.contactNumber ?? lead.mobile ?? "",
  );
  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState(
    lead.areaOfInterest
      ? `${lead.companyName} — ${lead.areaOfInterest}`
      : `${lead.companyName} — Opportunity`,
  );
  const [dealAmount, setDealAmount] = useState("");
  const [dealCloseDate, setDealCloseDate] = useState("");
  const [dealStage, setDealStage] = useState("");
  const [campaignSource, setCampaignSource] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const converting = convertMutation.isPending;
  const isExistingAccountMissing =
    accountMode === "existing" && !existingAccountId;
  const stageValue =
    dealStage || (boardStages[0] ? String(boardStages[0].id) : "");

  async function submit(confirmDuplicate: boolean) {
    if (isExistingAccountMissing) {
      setError("Select an existing account to link this lead to.");
      return;
    }
    setError(null);
    setDuplicateWarning(null);
    const input: ConvertLeadInput = {
      accountMode,
      existingAccountId:
        accountMode === "existing" ? Number(existingAccountId) : undefined,
      contactName: contactName.trim() || undefined,
      contactTitle: contactTitle || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      confirmDuplicate,
      createDeal,
      dealTitle: createDeal ? dealName || undefined : undefined,
      dealAmount: createDeal && dealAmount ? Number(dealAmount) : undefined,
      dealCloseDate: createDeal ? dealCloseDate || undefined : undefined,
      dealStageId: createDeal && stageValue ? Number(stageValue) : undefined,
      campaignSource: createDeal ? campaignSource || undefined : undefined,
      contactRole: createDeal ? contactRole || undefined : undefined,
    };
    try {
      const converted = await convertMutation.mutateAsync({
        id: lead.id,
        input,
      });
      onConverted?.(converted);
      onClose();
      toast.success("Lead converted successfully", {
        description: `${accountMode === "new" ? "New account" : "Account"} created${
          contactName.trim() ? ", contact linked" : ""
        }${createDeal ? ", deal created" : ""}.`,
      });
      celebrateCrm("lead.promoted");
      if (navigateToAccountOnSuccess && converted.linkedAccountId)
        router.push(`/crm/accounts/${converted.linkedAccountId}`);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "DUPLICATE_ACCOUNT") {
        setDuplicateWarning(err.message);
        return;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to convert this lead — please try again.";
      setError(message);
      toast.error("Conversion failed", { description: message });
    }
  }

  const accountLabel =
    accountMode === "new"
      ? lead.companyName || "Untitled Account"
      : existingAccountQuery.data?.name;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Convert Lead</DialogTitle>
        <DialogDescription>
          Create the Account, Contact and optional Deal this lead should become.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 text-sm">
        {/* Account */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Account
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={accountMode === "new" ? "default" : "outline"}
              className="rounded-xl flex-1"
              onClick={() => setAccountMode("new")}
            >
              Create New Account
            </Button>
            <Button
              type="button"
              size="sm"
              variant={accountMode === "existing" ? "default" : "outline"}
              className="rounded-xl flex-1"
              onClick={() => setAccountMode("existing")}
            >
              Link Existing Account
            </Button>
          </div>
          {accountMode === "new" ? (
            <Input value={lead.companyName || "Untitled Account"} disabled />
          ) : (
            <AccountPicker
              value={existingAccountId ? Number(existingAccountId) : undefined}
              onChange={(id) => setExistingAccountId(id ? String(id) : "")}
              placeholder="Select an existing account"
            />
          )}
        </div>

        {/* Contact */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Contact
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-9 rounded-xl col-span-2"
            />
            <Input
              placeholder="Title"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              className="h-9 rounded-xl"
            />
            <Input
              placeholder="Phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="h-9 rounded-xl"
            />
            <Input
              placeholder="Email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-9 rounded-xl col-span-2"
            />
          </div>
        </div>

        {/* Deal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={createDeal}
              onCheckedChange={(v) => setCreateDeal(!!v)}
            />
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Create a Deal
            </Label>
          </div>
          {createDeal && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 p-3 bg-slate-50/40">
              <Input
                placeholder="Deal Name"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="h-9 rounded-xl col-span-2"
              />
              <Input
                type="number"
                min={0}
                placeholder="Amount"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                className="h-9 rounded-xl"
              />
              <DatePicker
                value={dealCloseDate}
                onChange={setDealCloseDate}
                className="h-9"
              />
              <Select value={stageValue} onValueChange={setDealStage}>
                <SelectTrigger className="h-9 rounded-xl col-span-2">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {boardStages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Campaign Source"
                value={campaignSource}
                onChange={(e) => setCampaignSource(e.target.value)}
                className="h-9 rounded-xl"
              />
              <Input
                placeholder="Contact Role"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
          )}
        </div>

        {/* Confirmation summary */}
        {accountLabel && (
          <div className="rounded-2xl border border-brand-200/70 bg-brand-50/40 p-3 text-sm text-slate-700 flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-brand-600 mt-0.5 shrink-0" />
            <p>
              This will{" "}
              {accountMode === "new"
                ? "create a new Account"
                : "link to the existing Account"}{" "}
              <span className="font-bold">&quot;{accountLabel}&quot;</span>
              {contactName.trim() && (
                <>
                  {" "}
                  with contact <span className="font-bold">{contactName}</span>
                </>
              )}
              {createDeal && (
                <>
                  {" "}
                  and a Deal{" "}
                  <span className="font-bold">
                    &quot;{dealName || `${lead.companyName} — Opportunity`}
                    &quot;
                  </span>
                </>
              )}
              .
            </p>
          </div>
        )}

        {duplicateWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="font-bold">{duplicateWarning}</p>
              <p className="mt-0.5 text-amber-700">
                Consider switching to &quot;Link Existing Account&quot; instead
                of creating a duplicate.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 mt-2 rounded-lg text-xs border-amber-300 bg-white"
                onClick={() => void submit(true)}
              >
                Create anyway
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
          disabled={converting}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={converting || isExistingAccountMissing}
          onClick={() => void submit(false)}
        >
          {converting ? "Converting…" : "Convert"}
        </Button>
      </DialogFooter>
    </>
  );
}
