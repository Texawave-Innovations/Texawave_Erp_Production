"use client";

import type { ConvertLeadInput, Lead } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { AccountCombobox } from "../../accounts/components/AccountCombobox";
import { usePipelineStages } from "../../pipeline-stages/hooks";
import { useConvertLead } from "../hooks";

export interface ConvertLeadDialogProps {
  lead: Lead;
  onConverted: () => void;
  onCancel: () => void;
}

/** Reproduces legacy domain/LeadConvertDialog.tsx, including the
 * "Create a Deal" step (wired to the real Opportunities API — see
 * apps/api/src/modules/crm/leads/leads.repository.ts `convert()`).
 * Server-side duplicate detection (`DUPLICATE_ACCOUNT`) surfaces as a
 * warning with a "Create anyway" action, matching the legacy
 * confirm-and-retry flow.
 *
 * The caller must mount this with `key={lead.id}` (see LeadList.tsx) so
 * switching to a different lead remounts the form with fresh initial
 * values, rather than needing an effect to re-sync state off a changed
 * prop. */
export function ConvertLeadDialog({
  lead,
  onConverted,
  onCancel,
}: ConvertLeadDialogProps) {
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [existingAccountId, setExistingAccountId] = useState<
    number | undefined
  >();
  const [contactName, setContactName] = useState(lead.prospectName);
  const [contactTitle, setContactTitle] = useState(lead.title ?? "");
  const [contactEmail, setContactEmail] = useState(lead.email ?? "");
  const [contactPhone, setContactPhone] = useState(lead.contactNumber ?? "");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const convertMutation = useConvertLead();

  const [createDeal, setCreateDeal] = useState(true);
  const [dealTitle, setDealTitle] = useState(
    `${lead.companyName} — Opportunity`,
  );
  const [dealAmount, setDealAmount] = useState("");
  const [dealCloseDate, setDealCloseDate] = useState("");
  const [dealStageId, setDealStageId] = useState<number | undefined>();
  const [campaignSource, setCampaignSource] = useState("");
  const [contactRole, setContactRole] = useState("");
  const stagesQuery = usePipelineStages();
  const boardStages = (stagesQuery.data ?? [])
    .filter((s) => !s.isWon && !s.isLost && !s.isOnHold)
    .sort((a, b) => a.order - b.order);

  async function submit(confirmDuplicate: boolean) {
    setError(null);
    setDuplicateWarning(null);
    const input: ConvertLeadInput = {
      accountMode,
      existingAccountId:
        accountMode === "existing" ? existingAccountId : undefined,
      contactName: contactName || undefined,
      contactTitle: contactTitle || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      confirmDuplicate,
      createDeal,
      dealTitle: createDeal ? dealTitle || undefined : undefined,
      dealAmount: createDeal && dealAmount ? Number(dealAmount) : undefined,
      dealCloseDate: createDeal ? dealCloseDate || undefined : undefined,
      dealStageId: createDeal ? dealStageId : undefined,
      campaignSource: createDeal ? campaignSource || undefined : undefined,
      contactRole: createDeal ? contactRole || undefined : undefined,
    };
    try {
      await convertMutation.mutateAsync({ id: lead.id, input });
      onConverted();
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "DUPLICATE_ACCOUNT") {
        setDuplicateWarning(err.message);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to convert this lead — please try again.",
      );
    }
  }

  const isExistingAccountMissing =
    accountMode === "existing" && !existingAccountId;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className="flex flex-col gap-5"
    >
      <section className="flex flex-col gap-2">
        <span className="text-theme-xs font-bold uppercase tracking-wide text-gray-500">
          Account
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={accountMode === "new" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setAccountMode("new")}
          >
            Create New Account
          </Button>
          <Button
            type="button"
            size="sm"
            variant={accountMode === "existing" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setAccountMode("existing")}
          >
            Link Existing Account
          </Button>
        </div>
        {accountMode === "new" ? (
          <Input value={lead.companyName} disabled />
        ) : (
          <AccountCombobox
            value={existingAccountId}
            onChange={setExistingAccountId}
          />
        )}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <span className="col-span-2 text-theme-xs font-bold uppercase tracking-wide text-gray-500">
          Contact
        </span>
        <div className="col-span-2">
          <FormField label="Name">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Title">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Phone">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          )}
        </FormField>
        <div className="col-span-2">
          <FormField label="Email">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="space-y-2">
        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={createDeal}
            onChange={(e) => setCreateDeal(e.target.checked)}
          />
          <span className="text-theme-xs font-bold uppercase tracking-wide text-gray-500">
            Create a Deal
          </span>
        </label>
        {createDeal ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
            <div className="col-span-2">
              <FormField label="Deal Name">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={dealTitle}
                    onChange={(e) => setDealTitle(e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <FormField label="Amount">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  value={dealAmount}
                  onChange={(e) => setDealAmount(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Expected Close Date">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="date"
                  value={dealCloseDate}
                  onChange={(e) => setDealCloseDate(e.target.value)}
                />
              )}
            </FormField>
            <div className="col-span-2">
              <FormField label="Stage">
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={dealStageId ?? ""}
                    onChange={(e) =>
                      setDealStageId(
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    disabled={stagesQuery.isPending}
                  >
                    <option value="">First board stage (default)</option>
                    {boardStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <FormField label="Campaign Source">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={campaignSource}
                  onChange={(e) => setCampaignSource(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Contact Role">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                />
              )}
            </FormField>
          </div>
        ) : null}
      </section>

      <p className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 text-theme-sm text-gray-700 dark:border-brand-900 dark:bg-brand-950/30 dark:text-gray-300">
        This will{" "}
        {accountMode === "new"
          ? "create a new Account"
          : "link to the existing Account"}{" "}
        <strong>
          {accountMode === "new" ? lead.companyName : "the selected account"}
        </strong>
        {contactName.trim() ? (
          <>
            {" "}
            with contact <strong>{contactName}</strong>
          </>
        ) : null}
        {createDeal ? (
          <>
            {" "}
            and a Deal{" "}
            <strong>
              &quot;{dealTitle || `${lead.companyName} — Opportunity`}&quot;
            </strong>
          </>
        ) : null}
        .
      </p>

      {duplicateWarning ? (
        <Alert variant="warning" title="This looks like an existing account">
          <p>{duplicateWarning}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => void submit(true)}
          >
            Create anyway
          </Button>
        </Alert>
      ) : null}

      {error ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={convertMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={convertMutation.isPending}
          disabled={isExistingAccountMissing}
        >
          Convert
        </Button>
      </div>
    </form>
  );
}
