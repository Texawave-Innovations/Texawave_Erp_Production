// CRM Core Domain — small reusable "Log to Account" action, used to link a row from the
// Yet to Happen / Call Back-Send Info / Keep in Touch / Not Interested sheets (section 9's
// "integrate properly with existing CRM sections" requirement) to the new Activity system,
// without changing those sheets' own purpose, columns, or existing behavior. Matches or creates
// an Account by company name, then logs a `CrmActivity` against it.
import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { celebrateCrm, CrmCelebrationKey } from "../celebration";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrmDomainData } from "./useCrmDomainData";
import {
  createCrmAccount,
  findPossibleDuplicateAccount,
} from "./accountsService";
import { logCrmActivity } from "./activitiesService";
import { CrmActivityType } from "./types";

const NEW_ACCOUNT_VALUE = "__new__";

const CHANNEL_CELEBRATION_KEY: Partial<
  Record<CrmActivityType, CrmCelebrationKey>
> = {
  WhatsApp: "whatsapp.logged",
  LinkedIn: "linkedin.logged",
  Email: "email.logged",
};

export function LogToAccountButton({
  companyName,
  activityType,
  subject,
  currentUser,
}: {
  companyName?: string;
  activityType: CrmActivityType;
  subject: string;
  currentUser: string;
}) {
  const { accounts } = useCrmDomainData();
  const [open, setOpen] = useState(false);
  const [accountChoice, setAccountChoice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const bestMatch = useMemo(
    () =>
      companyName
        ? findPossibleDuplicateAccount(accounts, { name: companyName })
        : undefined,
    [accounts, companyName],
  );

  const handleOpen = () => {
    setAccountChoice(bestMatch?.id || NEW_ACCOUNT_VALUE);
    setNotes("");
    setDone(false);
    setOpen(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const accountId =
        accountChoice === NEW_ACCOUNT_VALUE
          ? await createCrmAccount({
              name: companyName || "Untitled Account",
              ownerName: currentUser,
              createdBy: currentUser,
            })
          : accountChoice;
      await logCrmActivity({
        relatedType: "account",
        relatedId: accountId,
        type: activityType,
        subject,
        notes,
        occurredAt: Date.now(),
        createdBy: currentUser,
      });
      setDone(true);
      const celebrationKey = CHANNEL_CELEBRATION_KEY[activityType];
      if (celebrationKey) celebrateCrm(celebrationKey);
    } catch (err) {
      console.error("Failed to log activity to Account:", err);
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-lg gap-1 h-8 text-xs"
        onClick={handleOpen}
      >
        <Link2 className="h-3.5 w-3.5" /> Log to Account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Log to Account</DialogTitle>
          </DialogHeader>
          {done ? (
            <p className="text-sm text-emerald-600 py-2">
              Logged. Find it under that Account's Activities / Timeline tab.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Select value={accountChoice} onValueChange={setAccountChoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_ACCOUNT_VALUE}>
                      + Create new Account
                      {companyName ? ` — ${companyName}` : ""}
                    </SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {done ? (
              <Button onClick={() => setOpen(false)}>Close</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!accountChoice || saving}
                  onClick={handleConfirm}
                >
                  {saving ? "Logging…" : "Log Activity"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
