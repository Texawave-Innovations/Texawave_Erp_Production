"use client";

import type { ActivityType } from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/legacy-ui/dialog";
import { Label } from "@/components/legacy-ui/label";
import { Textarea } from "@/components/legacy-ui/textarea";
import { AccountPicker } from "@/features/crm/accounts/components/AccountPicker";
import { useAccounts, useCreateAccount } from "@/features/crm/accounts/hooks";
import { useCreateActivity } from "@/features/crm/activities/hooks";
import {
  celebrateCrm,
  type CrmCelebrationKey,
} from "@/features/crm/celebration";
import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const NEW_ACCOUNT_VALUE = "__new__";

const CHANNEL_CELEBRATION_KEY: Partial<
  Record<ActivityType, CrmCelebrationKey>
> = {
  WhatsApp: "whatsapp.logged",
  LinkedIn: "linkedin.logged",
  Email: "email.logged",
};

/** Small reusable "Log to Account" action (legacy
 * `domain/LogToAccountButton.tsx`) for the Yet to Happen / Call Back-Send
 * Info / Keep in Touch / Not Interested sheets: matches an Account by
 * company name (or offers to create one), then logs a `CrmActivity`
 * against it. Exported for those sheets. */
export function LogToAccountButton({
  companyName,
  activityType,
  subject,
}: {
  companyName?: string | undefined;
  activityType: ActivityType;
  subject: string;
}) {
  const accountsQuery = useAccounts({
    limit: 20,
    order: "asc",
    ...(companyName?.trim() ? { search: companyName.trim() } : {}),
  });
  const createAccount = useCreateAccount();
  const createActivity = useCreateActivity();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const accounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data],
  );
  const bestMatch = useMemo(() => {
    const name = companyName?.trim().toLowerCase();
    return name
      ? accounts.find((a) => a.name.trim().toLowerCase() === name)
      : undefined;
  }, [accounts, companyName]);

  function handleOpen() {
    setChoice(bestMatch ? String(bestMatch.id) : NEW_ACCOUNT_VALUE);
    setNotes("");
    setDone(false);
    setOpen(true);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const accountId =
        choice === NEW_ACCOUNT_VALUE
          ? (
              await createAccount.mutateAsync({
                name: companyName?.trim() || "Untitled Account",
              })
            ).id
          : Number(choice);
      await createActivity.mutateAsync({
        relatedType: "account",
        relatedId: accountId,
        type: activityType,
        subject,
        notes: notes || undefined,
        occurredAt: new Date().toISOString(),
      });
      setDone(true);
      const key = CHANNEL_CELEBRATION_KEY[activityType];
      if (key) celebrateCrm(key);
    } catch {
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setSaving(false);
    }
  }

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
              Logged. Find it under that Account&apos;s Activities / Timeline
              tab.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Account</Label>
                <AccountPicker
                  value={choice === NEW_ACCOUNT_VALUE ? -1 : Number(choice)}
                  onChange={(id) =>
                    setChoice(!id || id < 0 ? NEW_ACCOUNT_VALUE : String(id))
                  }
                  leadingOptions={[
                    {
                      id: -1,
                      label: `+ Create new Account${
                        companyName ? ` — ${companyName}` : ""
                      }`,
                    },
                  ]}
                />
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
                  disabled={!choice || saving}
                  onClick={() => void handleConfirm()}
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
