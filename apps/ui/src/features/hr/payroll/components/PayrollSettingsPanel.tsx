"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  type TabItem,
  Tabs,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { PayrollSettingsBody } from "../api";
import { PAY_DAYS_LABEL, describeError, timestamp } from "../format";
import { usePayrollSettings, useUpdatePayrollSettings } from "../hooks";
import { PAYROLL_SETTINGS_READ, PAYROLL_SETTINGS_WRITE } from "../permissions";
import { PAY_DAYS_MODES, type PayrollSettings, TAX_REGIMES } from "../types";
import { ServerError } from "./DialogParts";
import { QueryState } from "./QueryState";
import { ComponentsSection, TemplatesSection } from "./SalaryMastersSections";
import { NoAccess } from "./SectionHeader";
import { ProfessionalTaxSection, TaxRegimesSection } from "./TaxSetupSections";

type Key = keyof Omit<PayrollSettings, "isDefault" | "version" | "updatedAt">;

type Field =
  | { key: Key; label: string; kind: "number"; hint?: string; step?: string }
  | { key: Key; label: string; kind: "flag"; hint?: string }
  | { key: Key; label: string; kind: "text"; hint?: string; long?: boolean }
  | {
      key: Key;
      label: string;
      kind: "choice";
      hint?: string;
      options: ReadonlyArray<readonly [string, string]>;
    };

/** The settings form, grouped as in Docs/PAYROLL_AND_COMPLIANCE.md §3. */
const GROUPS: ReadonlyArray<{ title: string; fields: readonly Field[] }> = [
  {
    title: "Pay days & attendance",
    fields: [
      {
        key: "payDaysMode",
        label: "Per-day divisor",
        kind: "choice",
        options: PAY_DAYS_MODES.map((m) => [m, PAY_DAYS_LABEL[m]] as const),
        hint: "Each loss-of-pay day costs gross ÷ this many days.",
      },
      {
        key: "useAttendance",
        label: "Read the approved attendance month",
        kind: "flag",
        hint: "Absences, half days and overtime come from it; a run waits until every month is approved.",
      },
      {
        key: "unmarkedDaysAsAbsent",
        label: "Count a working day with no attendance as absent",
        kind: "flag",
      },
    ],
  },
  {
    title: "Overtime",
    fields: [
      { key: "overtimeEnabled", label: "Pay overtime", kind: "flag" },
      {
        key: "overtimeRatePerHour",
        label: "Fixed rate per hour (₹)",
        kind: "number",
        hint: "Empty = hourly wage × multiplier.",
      },
      {
        key: "overtimeMultiplier",
        label: "Multiplier",
        kind: "number",
        step: "0.01",
      },
      {
        key: "standardHoursPerDay",
        label: "Standard hours per day",
        kind: "number",
        step: "0.25",
      },
    ],
  },
  {
    title: "Provident Fund",
    fields: [
      { key: "pfWageCeiling", label: "PF wage ceiling (₹)", kind: "number" },
      {
        key: "pfCapAtCeiling",
        label: "Cap PF at the ceiling",
        kind: "flag",
        hint: "Off = PF on the full Basic + DA (voluntary).",
      },
      {
        key: "pfEmployeeRate",
        label: "Employee rate (%)",
        kind: "number",
        step: "0.01",
      },
      {
        key: "pfEmployerRate",
        label: "Employer rate (%)",
        kind: "number",
        step: "0.01",
      },
      { key: "epsRate", label: "EPS rate (%)", kind: "number", step: "0.01" },
      { key: "epsWageCeiling", label: "EPS wage ceiling (₹)", kind: "number" },
      { key: "epsAgeLimit", label: "No EPS from age", kind: "number" },
      { key: "edliRate", label: "EDLI rate (%)", kind: "number", step: "0.01" },
      {
        key: "edliWageCeiling",
        label: "EDLI wage ceiling (₹)",
        kind: "number",
      },
      {
        key: "pfAdminRate",
        label: "Admin charges (%)",
        kind: "number",
        step: "0.01",
      },
    ],
  },
  {
    title: "ESI",
    fields: [
      {
        key: "esiWageThreshold",
        label: "Eligibility up to (₹/month)",
        kind: "number",
      },
      {
        key: "esiEmployeeRate",
        label: "Employee rate (%)",
        kind: "number",
        step: "0.01",
      },
      {
        key: "esiEmployerRate",
        label: "Employer rate (%)",
        kind: "number",
        step: "0.01",
      },
    ],
  },
  {
    title: "Professional Tax & TDS",
    fields: [
      { key: "ptEnabled", label: "Deduct Professional Tax", kind: "flag" },
      {
        key: "ptDefaultStateCode",
        label: "Default PT state",
        kind: "text",
        hint: "e.g. TN — for work locations without a state of their own.",
      },
      {
        key: "tdsEnabled",
        label: "Deduct TDS",
        kind: "flag",
        hint: "Needs the year's tax regimes (Tax regimes tab).",
      },
      {
        key: "defaultTaxRegime",
        label: "Regime without a declaration",
        kind: "choice",
        options: TAX_REGIMES.map((r) => [r, `${r} regime`] as const),
      },
    ],
  },
  {
    title: "Statutory bonus & gratuity",
    fields: [
      {
        key: "bonusEligibilityLimit",
        label: "Bonus eligibility up to (₹)",
        kind: "number",
      },
      {
        key: "bonusCalculationCeiling",
        label: "Bonus calculation ceiling (₹)",
        kind: "number",
      },
      { key: "bonusPercent", label: "Bonus (%)", kind: "number", step: "0.01" },
      {
        key: "gratuityMinYears",
        label: "Gratuity after (years)",
        kind: "number",
      },
      { key: "gratuityCap", label: "Gratuity cap (₹)", kind: "number" },
    ],
  },
  {
    title: "Loans",
    fields: [
      {
        key: "loanMaxMultiple",
        label: "Principal limit (× gross)",
        kind: "number",
        step: "0.01",
        hint: "Above it only with an override reason and an organization-wide approver.",
      },
      {
        key: "loanMaxEmiPercent",
        label: "All EMIs up to (% of gross)",
        kind: "number",
        step: "0.01",
      },
    ],
  },
  {
    title: "Salary auto-split (gross only)",
    fields: [
      { key: "basicPercent", label: "Basic (%)", kind: "number", step: "0.01" },
      { key: "hraPercent", label: "HRA (%)", kind: "number", step: "0.01" },
      {
        key: "conveyancePercent",
        label: "Conveyance (%)",
        kind: "number",
        step: "0.01",
      },
    ],
  },
  {
    title: "Employer details (payslips, Form 16, statutory files)",
    fields: [
      { key: "companyName", label: "Company name", kind: "text" },
      { key: "companyAddress", label: "Address", kind: "text", long: true },
      { key: "companyGstin", label: "GSTIN", kind: "text" },
      { key: "companyPan", label: "PAN", kind: "text" },
      { key: "companyTan", label: "TAN", kind: "text" },
      {
        key: "pfEstablishmentCode",
        label: "PF establishment code",
        kind: "text",
      },
      { key: "esiEmployerCode", label: "ESI employer code", kind: "text" },
    ],
  },
];

type Draft = Record<Key, string | boolean>;

function toDraft(s: PayrollSettings): Draft {
  const out = {} as Draft;
  for (const g of GROUPS) {
    for (const f of g.fields) {
      const v = s[f.key];
      out[f.key] = typeof v === "boolean" ? v : v === null ? "" : String(v);
    }
  }
  return out;
}

/** Only the changed fields go to the API (it is a partial update). */
function changes(
  draft: Draft,
  saved: PayrollSettings,
): { body: PayrollSettingsBody } | { error: string } {
  const body: Record<string, unknown> = { version: saved.version };
  for (const g of GROUPS) {
    for (const f of g.fields) {
      const value = draft[f.key];
      const before = saved[f.key];
      if (f.kind === "flag") {
        if (value !== before) body[f.key] = value;
        continue;
      }
      const text = String(value).trim();
      if (f.kind === "number") {
        if (text === "") {
          if (f.key === "overtimeRatePerHour") {
            if (before !== null) body[f.key] = null;
            continue;
          }
          return { error: `${f.label}: enter a number` };
        }
        const n = Number(text);
        if (!Number.isFinite(n)) return { error: `${f.label}: enter a number` };
        if (n !== before) body[f.key] = n;
        continue;
      }
      const next =
        text === ""
          ? null
          : f.key === "ptDefaultStateCode"
            ? text.toUpperCase()
            : text;
      if (next !== before) body[f.key] = next;
    }
  }
  return { body: body as PayrollSettingsBody };
}

function PolicyForm({ settings }: { settings: PayrollSettings }) {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const update = useUpdatePayrollSettings();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = changes(draft, settings);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    if (Object.keys(res.body).length === 1) {
      setError("Nothing changed.");
      return;
    }
    setError(null);
    try {
      const saved = await update.mutateAsync(res.body);
      setDraft(toDraft(saved));
      toast({ title: "Payroll settings saved", variant: "success" });
    } catch (err) {
      setError(describeError(err));
    }
  }

  const set = (key: Key, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {settings.isDefault ? (
        <Alert variant="info" title="Built-in defaults">
          Nothing has been saved yet; these are the statutory defaults.
        </Alert>
      ) : (
        <p className="text-theme-xs text-gray-600 dark:text-gray-400">
          Last changed {timestamp(settings.updatedAt)}. Changes apply to payroll
          runs from now on; finalized months are never recalculated.
        </p>
      )}
      {!canWrite ? (
        <Alert variant="info" title="Read-only">
          Changing payroll settings needs hr.payroll_settings.write.
        </Alert>
      ) : null}
      {GROUPS.map((g) => (
        <Card key={g.title}>
          <fieldset disabled={!canWrite} className="flex flex-col gap-3">
            <legend className="mb-2 text-theme-md font-semibold text-gray-900 dark:text-white/90">
              {g.title}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.fields.map((f) =>
                f.kind === "flag" ? (
                  <div
                    key={f.key}
                    className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3"
                  >
                    <label className="flex items-center gap-3 text-theme-sm font-medium text-gray-700 dark:text-white/90">
                      <Checkbox
                        checked={draft[f.key] === true}
                        onChange={(e) => set(f.key, e.target.checked)}
                      />
                      {f.label}
                    </label>
                    {f.hint ? (
                      <span className="ml-7 text-theme-xs text-gray-500 dark:text-gray-400">
                        {f.hint}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div
                    key={f.key}
                    className={
                      f.kind === "text" && f.long
                        ? "sm:col-span-2 lg:col-span-3"
                        : undefined
                    }
                  >
                    <FormField label={f.label} hint={f.hint}>
                      {(fp) =>
                        f.kind === "choice" ? (
                          <Select
                            {...fp}
                            value={String(draft[f.key])}
                            onChange={(e) => set(f.key, e.target.value)}
                          >
                            {f.options.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        ) : f.kind === "text" && f.long ? (
                          <Textarea
                            {...fp}
                            rows={2}
                            value={String(draft[f.key])}
                            onChange={(e) => set(f.key, e.target.value)}
                          />
                        ) : (
                          <Input
                            {...fp}
                            type={f.kind === "number" ? "number" : "text"}
                            {...(f.kind === "number"
                              ? {
                                  step: f.step ?? "1",
                                  inputMode: "decimal" as const,
                                }
                              : {})}
                            value={String(draft[f.key])}
                            onChange={(e) => set(f.key, e.target.value)}
                          />
                        )
                      }
                    </FormField>
                  </div>
                ),
              )}
            </div>
          </fieldset>
        </Card>
      ))}
      <ServerError message={error} />
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending}>
            Save settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function PolicySection() {
  const query = usePayrollSettings();
  return (
    <div className="flex flex-col gap-4">
      <QueryState query={query} area="payroll settings" />
      {/* Remount on a new version so the draft starts from what was saved. */}
      {query.data ? (
        <PolicyForm key={query.data.version} settings={query.data} />
      ) : null}
    </div>
  );
}

type SettingsTab = "policy" | "components" | "templates" | "tax" | "pt";

/** HR → Payroll → Settings: the organization's payroll configuration
 * (Docs/PAYROLL_AND_COMPLIANCE.md §4.2a, §4.10–§4.12). */
export function PayrollSettingsPanel() {
  const canRead = usePermission(PAYROLL_SETTINGS_READ);
  const [tab, setTab] = useState<SettingsTab>("policy");
  if (!canRead) return <NoAccess area="payroll settings" />;
  const tabs: TabItem<SettingsTab>[] = [
    { id: "policy", label: "Policy & statutory" },
    { id: "components", label: "Components" },
    { id: "templates", label: "Templates" },
    { id: "tax", label: "Tax regimes" },
    { id: "pt", label: "Professional Tax" },
  ];
  return (
    <Tabs
      label="Payroll settings sections"
      idPrefix="payroll-settings"
      tabs={tabs}
      value={tab}
      onChange={setTab}
    >
      {tab === "policy" ? <PolicySection /> : null}
      {tab === "components" ? <ComponentsSection /> : null}
      {tab === "templates" ? <TemplatesSection /> : null}
      {tab === "tax" ? <TaxRegimesSection /> : null}
      {tab === "pt" ? <ProfessionalTaxSection /> : null}
    </Tabs>
  );
}
