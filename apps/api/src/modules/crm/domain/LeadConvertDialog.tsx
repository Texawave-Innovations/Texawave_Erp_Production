// Reusable Lead → Account/Contact/Deal conversion dialog. Extracted from the original inline
// dialog in `Leads.tsx` (logic and fields unchanged) so both the Leads list and the new Lead
// Detail page can trigger the exact same conversion workflow instead of duplicating it.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, update } from "firebase/database";
import { database } from "@/services/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { celebrateCrm } from "../celebration";
import { LeadsRow } from "../types";
import { DatePicker } from "../components/DatePicker";
import {
  createCrmAccount,
  findPossibleDuplicateAccount,
} from "./accountsService";
import { createCrmContact } from "./contactsService";
import { createCrmOpportunity } from "./opportunitiesService";
import { useCrmDomainData } from "./useCrmDomainData";
import { useCrmPipelineStages } from "./pipelineStagesService";
import { writeCrmAuditLog } from "../intelligence/auditService";
import { removeFromCollection } from "./firebaseCollection";
import {
  CRM_ACCOUNTS_PATH,
  CRM_CONTACTS_PATH,
  CRM_OPPORTUNITIES_PATH,
} from "./config";

interface LeadConvertFormState {
  accountMode: "new" | "existing";
  existingAccountId: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  createDeal: boolean;
  dealName: string;
  dealAmount: string;
  dealCloseDate: string;
  dealStage: string;
  campaignSource: string;
  contactRole: string;
}

function emptyConvertForm(): LeadConvertFormState {
  return {
    accountMode: "new",
    existingAccountId: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    createDeal: true,
    dealName: "",
    dealAmount: "",
    dealCloseDate: "",
    dealStage: "",
    campaignSource: "",
    contactRole: "",
  };
}

export interface LeadConvertResult {
  accountId: string;
  contactId?: string;
  opportunityId?: string;
}

interface LeadConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
  row: LeadsRow;
  currentUser: string;
  onConverted?: (result: LeadConvertResult) => void;
  /** Whether to navigate to the new Account page after a successful conversion. Defaults to true,
   *  matching the original Leads-list behavior; the Lead Detail page passes false so it can stay
   *  on the (now-converted) lead and show the new links inline instead. */
  navigateToAccountOnSuccess?: boolean;
}

export function LeadConvertDialog({
  open,
  onOpenChange,
  rowId,
  row,
  currentUser,
  onConverted,
  navigateToAccountOnSuccess = true,
}: LeadConvertDialogProps) {
  const navigate = useNavigate();
  const { accounts } = useCrmDomainData();
  const { boardStages } = useCrmPipelineStages();
  const [form, setForm] = useState<LeadConvertFormState>(emptyConvertForm());
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDuplicateWarning(null);
    setConfirmedDuplicate(false);
    setForm({
      ...emptyConvertForm(),
      contactName: row.prospectName || "",
      contactTitle: row.title || "",
      contactEmail: row.email || "",
      contactPhone: row.contactNumber || row.mobile || "",
      dealName: row.areaOfInterest
        ? `${row.companyName} — ${row.areaOfInterest}`
        : `${row.companyName || ""} — Opportunity`,
      dealStage: boardStages[0]?.id || "new_lead",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rowId]);

  const isExistingAccountMissing =
    form.accountMode === "existing" && !form.existingAccountId;

  const handleConvert = async () => {
    if (isExistingAccountMissing) {
      setError("Select an existing account to link this lead to.");
      return;
    }
    const isNewAccount = form.accountMode === "new";
    if (isNewAccount && !confirmedDuplicate) {
      const dup = findPossibleDuplicateAccount(accounts, {
        name: row.companyName,
        website: row.website || row.domain,
        email: row.email,
      });
      if (dup) {
        setDuplicateWarning(dup.name);
        return;
      }
    }
    setConverting(true);
    setError(null);
    // Tracks only what THIS conversion attempt creates, so a failure partway through (e.g. the
    // Deal create call throwing) can roll back the orphaned Account/Contact instead of leaving
    // them behind with the lead still unconverted — a retry would otherwise create a duplicate.
    let createdAccountId: string | undefined;
    let createdContactId: string | undefined;
    let createdOpportunityId: string | undefined;
    let leadMarkedConverted = false;
    try {
      const accountId = isNewAccount
        ? await createCrmAccount({
            name: row.companyName || "Untitled Account",
            industry: row.industry || "",
            website: row.website || row.domain || "",
            hq: row.hq || row.city || "",
            phone: row.contactNumber || "",
            email: row.email || "",
            ownerName: row.assignedTo || currentUser,
            sourceLeadRowId: rowId,
            createdBy: currentUser,
          })
        : form.existingAccountId;
      if (!accountId)
        throw new Error("Select an existing account to link this lead to.");
      if (isNewAccount) createdAccountId = accountId;

      let contactId: string | undefined;
      if (form.contactName.trim()) {
        contactId = await createCrmContact({
          accountId,
          name: form.contactName,
          designation: form.contactTitle || "",
          department: "",
          email: form.contactEmail || "",
          phone: form.contactPhone || "",
          whatsapp: "",
          isPrimary: true,
          isDecisionMaker: false,
          createdBy: currentUser,
        });
        createdContactId = contactId;
      }

      let opportunityId: string | undefined;
      if (form.createDeal) {
        opportunityId = await createCrmOpportunity(
          {
            accountId,
            leadRowId: rowId,
            title: form.dealName || `${row.companyName} — Opportunity`,
            ownerName: row.assignedTo || currentUser,
            stage: form.dealStage || boardStages[0]?.id || "new_lead",
            estimatedValue: Number(form.dealAmount) || 0,
            // Firebase `set()` rejects `undefined` values outright — an empty optional field must
            // be omitted as `null` (RTDB's own "no value" idiom), never `undefined`.
            expectedCloseDate: form.dealCloseDate || null,
            campaignSource: form.campaignSource || null,
            contactRole: form.contactRole || null,
            priority: (row.priority as "High" | "Medium" | "Low") || "Medium",
          },
          currentUser,
        );
        createdOpportunityId = opportunityId;
      }

      await update(ref(database, `crm/leads/${rowId}`), {
        linkedAccountId: accountId,
        ...(contactId ? { linkedContactId: contactId } : {}),
        ...(opportunityId ? { linkedOpportunityId: opportunityId } : {}),
        leadStatus: "CONVERTED",
      });
      leadMarkedConverted = true;
      await writeCrmAuditLog({
        action: "lead_converted",
        entityType: "lead",
        entityId: rowId,
        companyKey: accountId,
        details: `Lead "${row.companyName}" converted to ${isNewAccount ? "a new Account" : "an existing Account"}${contactId ? " with a Contact" : ""}${opportunityId ? " and a new Deal" : ""}`,
        by: currentUser,
        at: Date.now(),
      });

      onConverted?.({ accountId, contactId, opportunityId });
      onOpenChange(false);
      toast({
        title: "Lead converted successfully",
        description: `${isNewAccount ? "New account" : "Account"} created${contactId ? ", contact linked" : ""}${opportunityId ? ", deal created" : ""}.`,
      });
      celebrateCrm("lead.promoted");
      if (navigateToAccountOnSuccess) navigate(`/crm/accounts/${accountId}`);
    } catch (err) {
      console.error("Failed to convert Lead:", err);
      // Best-effort rollback of whatever this attempt created before the failure, so a retry
      // doesn't leave an orphaned duplicate Account/Contact/Deal behind alongside the new one.
      await Promise.all([
        createdOpportunityId
          ? removeFromCollection(
              CRM_OPPORTUNITIES_PATH,
              createdOpportunityId,
            ).catch(() => {})
          : Promise.resolve(),
        createdContactId
          ? removeFromCollection(CRM_CONTACTS_PATH, createdContactId).catch(
              () => {},
            )
          : Promise.resolve(),
        createdAccountId
          ? removeFromCollection(CRM_ACCOUNTS_PATH, createdAccountId).catch(
              () => {},
            )
          : Promise.resolve(),
        // The lead itself was already flipped to CONVERTED and linked to the records above — if a
        // later step (the audit log write, most likely) is what actually threw, those records are
        // now being deleted, so the lead's CONVERTED/linked state must be undone too or it's left
        // pointing at ids that no longer exist and can never be retried through this dialog again.
        leadMarkedConverted
          ? update(ref(database, `crm/leads/${rowId}`), {
              linkedAccountId: row.linkedAccountId ?? null,
              linkedContactId: row.linkedContactId ?? null,
              linkedOpportunityId: row.linkedOpportunityId ?? null,
              leadStatus: row.leadStatus ?? null,
            }).catch(() => {})
          : Promise.resolve(),
      ]);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to convert this lead — please try again.";
      setError(message);
      toast({
        title: "Conversion failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const accountLabel =
    form.accountMode === "new"
      ? row.companyName || "Untitled Account"
      : accounts.find((a) => a.id === form.existingAccountId)?.name;

  return (
    <Dialog open={open} onOpenChange={(v) => !converting && onOpenChange(v)}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>
            Create the Account, Contact and optional Deal this lead should
            become.
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
                variant={form.accountMode === "new" ? "default" : "outline"}
                className="rounded-xl flex-1"
                onClick={() => setForm((f) => ({ ...f, accountMode: "new" }))}
              >
                Create New Account
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  form.accountMode === "existing" ? "default" : "outline"
                }
                className="rounded-xl flex-1"
                onClick={() =>
                  setForm((f) => ({ ...f, accountMode: "existing" }))
                }
              >
                Link Existing Account
              </Button>
            </div>
            {form.accountMode === "new" ? (
              <Input value={row.companyName || "Untitled Account"} disabled />
            ) : (
              <Select
                value={form.existingAccountId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, existingAccountId: v }))
                }
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select an existing account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
                className="h-9 rounded-xl col-span-2"
              />
              <Input
                placeholder="Title"
                value={form.contactTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactTitle: e.target.value }))
                }
                className="h-9 rounded-xl"
              />
              <Input
                placeholder="Phone"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPhone: e.target.value }))
                }
                className="h-9 rounded-xl"
              />
              <Input
                placeholder="Email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactEmail: e.target.value }))
                }
                className="h-9 rounded-xl col-span-2"
              />
            </div>
          </div>

          {/* Deal */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.createDeal}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, createDeal: !!v }))
                }
              />
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Create a Deal
              </Label>
            </div>
            {form.createDeal && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 p-3 bg-slate-50/40">
                <Input
                  placeholder="Deal Name"
                  value={form.dealName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dealName: e.target.value }))
                  }
                  className="h-9 rounded-xl col-span-2"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Amount"
                  value={form.dealAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dealAmount: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <DatePicker
                  value={form.dealCloseDate}
                  onChange={(v) => setForm((f) => ({ ...f, dealCloseDate: v }))}
                  className="h-9"
                />
                <Select
                  value={form.dealStage}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, dealStage: v }))
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl col-span-2">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {boardStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Campaign Source"
                  value={form.campaignSource}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, campaignSource: e.target.value }))
                  }
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Contact Role"
                  value={form.contactRole}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactRole: e.target.value }))
                  }
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
                {form.accountMode === "new"
                  ? "create a new Account"
                  : "link to the existing Account"}{" "}
                <span className="font-bold">"{accountLabel}"</span>
                {form.contactName.trim() && (
                  <>
                    {" "}
                    with contact{" "}
                    <span className="font-bold">{form.contactName}</span>
                  </>
                )}
                {form.createDeal && (
                  <>
                    {" "}
                    and a Deal{" "}
                    <span className="font-bold">
                      "{form.dealName || `${row.companyName} — Opportunity`}"
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
                <p className="font-bold">
                  This looks like an existing account: "{duplicateWarning}"
                </p>
                <p className="mt-0.5 text-amber-700">
                  Consider switching to "Link Existing Account" instead of
                  creating a duplicate.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 mt-2 rounded-lg text-xs border-amber-300 bg-white"
                  onClick={() => {
                    setConfirmedDuplicate(true);
                    setDuplicateWarning(null);
                  }}
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
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={converting || isExistingAccountMissing}
            onClick={handleConvert}
          >
            {converting ? "Converting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
