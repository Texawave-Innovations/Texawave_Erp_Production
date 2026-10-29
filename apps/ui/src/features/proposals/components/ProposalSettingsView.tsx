"use client";

import type { ProposalSettings } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useProposalSettings, useUpdateProposalSettings } from "../hooks";
import { PROPOSALS_MANAGE_SETTINGS, PROPOSALS_READ } from "../permissions";

/** Legacy `ProposalSettingsPage.tsx` — company branding + numbering config. */
export function ProposalSettingsView() {
  const canRead = usePermission(PROPOSALS_READ);
  const query = useProposalSettings();

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Proposal Settings"
      >
        Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to Proposal Settings"
        >
          Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return <ProposalSettingsForm settings={query.data} />;
}

type ToggleKey =
  | "showHeader"
  | "showHeaderLogo"
  | "showHeaderCompanyName"
  | "showHeaderDocTitle"
  | "showFooter"
  | "showFooterEmail"
  | "showFooterPhone"
  | "showFooterWebsite"
  | "showFooterAddress"
  | "showFooterPageNumber";

const HEADER_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: "showHeaderLogo",
    label: "Show logo",
    hint: "Official logo in the top-right of the header",
  },
  {
    key: "showHeaderCompanyName",
    label: "Show company name",
    hint: "Company name above the proposal title",
  },
  {
    key: "showHeaderDocTitle",
    label: "Show document title",
    hint: "The proposal title banner",
  },
];

const FOOTER_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: "showFooterEmail",
    label: "Show email",
    hint: "Official contact email",
  },
  {
    key: "showFooterPhone",
    label: "Show phone number",
    hint: "Company telephone contact",
  },
  { key: "showFooterWebsite", label: "Show website", hint: "Website URL" },
  {
    key: "showFooterAddress",
    label: "Show registered address",
    hint: "Office address line",
  },
  {
    key: "showFooterPageNumber",
    label: "Show reference line",
    hint: "Proposal number on every printed page",
  },
];

/** Legacy `ProposalSettingsPage.tsx` — company branding, granular header /
 * footer toggles, and numbering format with a live sample. */
function ProposalSettingsForm({ settings }: { settings: ProposalSettings }) {
  const canManage = usePermission(PROPOSALS_MANAGE_SETTINGS);
  const { toast } = useToast();
  const updateMutation = useUpdateProposalSettings();

  const [companyName, setCompanyName] = useState(settings.companyName ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [email, setEmail] = useState(settings.email ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [website, setWebsite] = useState(settings.website ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [prefix, setPrefix] = useState(settings.prefix);
  const [yearFormat, setYearFormat] = useState(settings.yearFormat);
  const [sequenceDigits, setSequenceDigits] = useState(settings.sequenceDigits);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    showHeader: settings.showHeader,
    showHeaderLogo: settings.showHeaderLogo,
    showHeaderCompanyName: settings.showHeaderCompanyName,
    showHeaderDocTitle: settings.showHeaderDocTitle,
    showFooter: settings.showFooter,
    showFooterEmail: settings.showFooterEmail,
    showFooterPhone: settings.showFooterPhone,
    showFooterWebsite: settings.showFooterWebsite,
    showFooterAddress: settings.showFooterAddress,
    showFooterPageNumber: settings.showFooterPageNumber,
  });

  const year = new Date().getFullYear();
  const seq = String(1).padStart(sequenceDigits, "0");
  const sampleNumber =
    yearFormat === "NONE"
      ? [prefix, seq].join("-")
      : [
          prefix,
          yearFormat === "YYYY" ? String(year) : String(year).slice(-2),
          seq,
        ].join("-");

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync({
        companyName: companyName || undefined,
        logoUrl: logoUrl || undefined,
        email: email || undefined,
        phone: phone || undefined,
        website: website || undefined,
        address: address || undefined,
        prefix,
        yearFormat,
        sequenceDigits,
        ...toggles,
      });
      toast({ title: "Settings saved", variant: "success" });
    } catch {
      toast({ title: "Could not save settings", variant: "error" });
    }
  }

  function textField(
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder?: string,
  ) {
    return (
      <FormField label={label}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={value}
            placeholder={placeholder}
            onChange={(e) => set(e.target.value)}
            disabled={!canManage}
          />
        )}
      </FormField>
    );
  }

  function toggleRow(
    key: ToggleKey,
    label: string,
    hint: string,
    disabled = false,
  ) {
    return (
      <label
        key={key}
        className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
      >
        <span>
          <span className="block text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
            {label}
          </span>
          <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
            {hint}
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1"
          checked={toggles[key]}
          disabled={!canManage || disabled}
          onChange={(e) =>
            setToggles((prev) => ({ ...prev, [key]: e.target.checked }))
          }
        />
      </label>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Company Branding
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField("Company Name", companyName, setCompanyName)}
          {textField(
            "Logo URL",
            logoUrl,
            setLogoUrl,
            "https://example.com/logo.png",
          )}
          {textField("Email", email, setEmail)}
          {textField("Phone", phone, setPhone)}
          {textField("Website", website, setWebsite)}
          {textField("Address", address, setAddress)}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Header Settings
          </h2>
          <div className="flex flex-col gap-2">
            {toggleRow(
              "showHeader",
              "Show header",
              "Master switch for the document header",
            )}
            {HEADER_TOGGLES.map((t) =>
              toggleRow(
                t.key,
                t.label,
                t.hint,
                !toggles.showHeader && t.key !== "showHeaderDocTitle",
              ),
            )}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Footer Settings
          </h2>
          <div className="flex flex-col gap-2">
            {toggleRow(
              "showFooter",
              "Show footer",
              "Master switch for the document footer",
            )}
            {FOOTER_TOGGLES.map((t) =>
              toggleRow(t.key, t.label, t.hint, !toggles.showFooter),
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Proposal Numbering
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Prefix">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                disabled={!canManage}
              />
            )}
          </FormField>
          <FormField label="Year Format">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={yearFormat}
                onChange={(e) =>
                  setYearFormat(e.target.value as "YYYY" | "YY" | "NONE")
                }
                disabled={!canManage}
              >
                <option value="YYYY">YYYY ({year})</option>
                <option value="YY">YY ({String(year).slice(-2)})</option>
                <option value="NONE">No year</option>
              </Select>
            )}
          </FormField>
          <FormField label="Sequence Digits">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min={1}
                max={8}
                value={sequenceDigits}
                onChange={(e) => setSequenceDigits(Number(e.target.value))}
                disabled={!canManage}
              />
            )}
          </FormField>
        </div>
        <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
          Number format sample:{" "}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {sampleNumber}
          </span>{" "}
          — numbering restarts each year when a year part is used.
        </p>
      </Card>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" loading={updateMutation.isPending}>
            Save Settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}
