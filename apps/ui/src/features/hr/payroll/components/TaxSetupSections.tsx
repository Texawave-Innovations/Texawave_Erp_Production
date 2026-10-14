"use client";

import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useWorkLocations } from "@/features/hr/holidays/hooks";
import { usePermission } from "@/hooks/usePermission";
import type { TaxRegimeBody } from "../api";
import {
  MONTH_OPTIONS,
  describeError,
  isoDate,
  money,
  recentFinancialYears,
} from "../format";
import {
  useCreatePtSlab,
  usePtLocationStates,
  usePtSlabs,
  useSaveTaxRegime,
  useSetPtLocationState,
  useTaxRegimes,
  useUpdatePtSlab,
} from "../hooks";
import { PAYROLL_SETTINGS_WRITE } from "../permissions";
import {
  type PtSlab,
  TAX_REGIMES,
  type TaxRegime,
  type TaxRegimeRules,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

// ---- income-tax regimes -------------------------------------------------------

interface SlabDraft {
  key: number;
  from: string;
  to: string;
  rate: string;
}
let slabKey = 1;

const AMOUNT_FIELDS = [
  ["standardDeduction", "Standard deduction (₹)"],
  ["rebateIncomeLimit", "87A rebate: income up to (₹)"],
  ["rebateMaxAmount", "87A rebate: at most (₹)"],
  ["cessPercent", "Cess (%)"],
  ["section80cLimit", "80C limit, old regime (₹)"],
  ["homeLoanInterestLimit", "Home-loan interest limit, old regime (₹)"],
] as const;
type AmountField = (typeof AMOUNT_FIELDS)[number][0];

function RegimeDialog({
  financialYear,
  regime,
  current,
  onClose,
}: {
  financialYear: string;
  regime: TaxRegime;
  current: TaxRegimeRules | null;
  onClose: () => void;
}) {
  const save = useSaveTaxRegime();
  const { toast } = useToast();
  const [amounts, setAmounts] = useState<Record<AmountField, string>>(() => {
    const out = {} as Record<AmountField, string>;
    for (const [k] of AMOUNT_FIELDS) {
      out[k] = current
        ? String(Number(current[k]))
        : k === "cessPercent"
          ? "4"
          : k === "section80cLimit"
            ? "150000"
            : k === "homeLoanInterestLimit"
              ? "200000"
              : "0";
    }
    return out;
  });
  const [slabs, setSlabs] = useState<SlabDraft[]>(
    current?.slabs.map((s) => ({
      key: slabKey++,
      from: String(Number(s.fromIncome)),
      to: s.toIncome === null ? "" : String(Number(s.toIncome)),
      rate: String(Number(s.ratePercent)),
    })) ?? [{ key: slabKey++, from: "0", to: "", rate: "0" }],
  );
  const [error, setError] = useState<string | null>(null);

  const updateSlab = (key: number, patch: Partial<SlabDraft>) =>
    setSlabs((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: TaxRegimeBody = {
      financialYear,
      regime,
      version: current?.version ?? 0,
      standardDeduction: Number(amounts.standardDeduction),
      rebateIncomeLimit: Number(amounts.rebateIncomeLimit),
      rebateMaxAmount: Number(amounts.rebateMaxAmount),
      cessPercent: Number(amounts.cessPercent),
      section80cLimit: Number(amounts.section80cLimit),
      homeLoanInterestLimit: Number(amounts.homeLoanInterestLimit),
      slabs: slabs.map((s) => ({
        fromIncome: Number(s.from),
        toIncome: s.to.trim() === "" ? null : Number(s.to),
        ratePercent: Number(s.rate),
      })),
    };
    if (
      AMOUNT_FIELDS.some(
        ([k]) => amounts[k].trim() === "" || !(Number(amounts[k]) >= 0),
      )
    )
      return setError("Every amount must be a number of 0 or more");
    if (
      body.slabs.some(
        (s) =>
          !Number.isFinite(s.fromIncome) || !Number.isFinite(s.ratePercent),
      )
    )
      return setError("Every slab needs a start and a rate");
    setError(null);
    try {
      await save.mutateAsync(body);
      toast({
        title: `${regime} regime ${financialYear} saved`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${regime} regime — FY ${financialYear}`}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          Enter the year&apos;s rules from the Finance Act. Slabs start at 0 and
          follow on; leave the last slab&apos;s upper limit empty.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AMOUNT_FIELDS.map(([k, label]) => (
            <FormField key={k} label={label}>
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={amounts[k]}
                  onChange={(e) =>
                    setAmounts((a) => ({ ...a, [k]: e.target.value }))
                  }
                />
              )}
            </FormField>
          ))}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Slabs (annual taxable income)
          </legend>
          {slabs.map((s, i) => (
            <div key={s.key} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Slab ${i + 1} from`}
                className="w-36"
                type="number"
                min={0}
                value={s.from}
                onChange={(e) => updateSlab(s.key, { from: e.target.value })}
              />
              <span className="text-theme-sm text-gray-500">to</span>
              <Input
                aria-label={`Slab ${i + 1} to`}
                className="w-36"
                type="number"
                min={0}
                placeholder="no limit"
                value={s.to}
                onChange={(e) => updateSlab(s.key, { to: e.target.value })}
              />
              <Input
                aria-label={`Slab ${i + 1} rate`}
                className="w-24"
                type="number"
                min={0}
                max={100}
                value={s.rate}
                onChange={(e) => updateSlab(s.key, { rate: e.target.value })}
              />
              <span className="text-theme-sm text-gray-500">%</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove slab ${i + 1}`}
                onClick={() =>
                  setSlabs((ss) => ss.filter((x) => x.key !== s.key))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const last = slabs.at(-1);
                setSlabs((ss) => [
                  ...ss,
                  { key: slabKey++, from: last?.to ?? "", to: "", rate: "" },
                ]);
              }}
            >
              Add slab
            </Button>
          </div>
        </fieldset>
        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel="Save regime"
        />
      </form>
    </Dialog>
  );
}

function RegimeCard({
  financialYear,
  regime,
  rules,
  canWrite,
}: {
  financialYear: string;
  regime: TaxRegime;
  rules: TaxRegimeRules | null;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-theme-md font-semibold text-gray-900 dark:text-white/90">
            {regime} regime
          </h3>
          {canWrite ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              {rules ? "Edit" : "Set up"}
            </Button>
          ) : null}
        </div>
        {rules ? (
          <>
            <p className="text-theme-xs text-gray-600 dark:text-gray-400">
              Standard deduction {money(rules.standardDeduction)} · rebate up to{" "}
              {money(rules.rebateIncomeLimit)} (max{" "}
              {money(rules.rebateMaxAmount)}) · cess {Number(rules.cessPercent)}
              %
            </p>
            <DataTable
              caption={`${regime} regime slabs ${financialYear}`}
              rows={rules.slabs}
              getRowKey={(r) => String(r.id)}
              columns={[
                { header: "From", cell: (r) => money(r.fromIncome) },
                {
                  header: "To",
                  cell: (r) => (r.toIncome === null ? "—" : money(r.toIncome)),
                },
                { header: "Rate", cell: (r) => `${Number(r.ratePercent)}%` },
              ]}
            />
          </>
        ) : (
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            Not set up for {financialYear}. With TDS on, a run is refused for
            employees on this regime until it is.
          </p>
        )}
      </div>
      {editing ? (
        <RegimeDialog
          financialYear={financialYear}
          regime={regime}
          current={rules}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Card>
  );
}

/** Income-tax rules per financial year and regime (§3.6, §4.11). */
export function TaxRegimesSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const years = recentFinancialYears(4);
  const [financialYear, setFinancialYear] = useState(years[0] ?? "");
  const query = useTaxRegimes(financialYear);
  const byRegime = new Map((query.data ?? []).map((r) => [r.regime, r]));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <FormField label="Financial year">
          {(f) => (
            <Select
              {...f}
              className="w-40"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </Card>
      <QueryState query={query} area="tax regimes" />
      {query.isSuccess ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {TAX_REGIMES.map((r) => (
            <RegimeCard
              key={`${financialYear}-${r}`}
              financialYear={financialYear}
              regime={r}
              rules={byRegime.get(r) ?? null}
              canWrite={canWrite}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- Professional Tax --------------------------------------------------------

function PtSlabDialog({ onClose }: { onClose: () => void }) {
  const create = useCreatePtSlab();
  const { toast } = useToast();
  const [stateCode, setStateCode] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [amount, setAmount] = useState("");
  const [specialMonth, setSpecialMonth] = useState("");
  const [specialAmount, setSpecialAmount] = useState("");
  const [months, setMonths] = useState<number[]>([]);
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = stateCode.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code))
      return setError("State code: 2–3 letters, e.g. TN");
    if (min === "" || !(Number(min) >= 0))
      return setError("Enter the minimum wage");
    if (max !== "" && Number(max) < Number(min))
      return setError("The maximum is below the minimum");
    if (amount === "" || !(Number(amount) >= 0))
      return setError("Enter the monthly PT");
    if ((specialMonth === "") !== (specialAmount === ""))
      return setError("Give the special month and its amount together");
    if (!from) return setError("Choose the effective-from date");
    setError(null);
    try {
      await create.mutateAsync({
        stateCode: code,
        minMonthlyWage: Number(min),
        maxMonthlyWage: max === "" ? null : Number(max),
        monthlyAmount: Number(amount),
        ...(specialMonth
          ? {
              specialMonth: Number(specialMonth),
              specialAmount: Number(specialAmount),
            }
          : {}),
        ...(months.length ? { applicableMonths: months } : {}),
        effectiveFrom: from,
      });
      toast({ title: `PT slab added for ${code}`, variant: "success" });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Professional Tax slab"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="State code" required hint="e.g. TN, KA, MH">
            {(f) => (
              <Input
                {...f}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Effective from" required>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Gross from (₹/month)" required>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Gross up to (₹/month)"
            hint="Empty = no upper limit."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="PT per month (₹)" required>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Special month" hint="Optional">
              {(f) => (
                <Select
                  {...f}
                  value={specialMonth}
                  onChange={(e) => setSpecialMonth(e.target.value)}
                >
                  <option value="">None</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Its amount (₹)">
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  value={specialAmount}
                  onChange={(e) => setSpecialAmount(e.target.value)}
                />
              )}
            </FormField>
          </div>
        </div>
        <fieldset>
          <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Deducted only in (leave all unticked for every month)
          </legend>
          <div className="flex flex-wrap gap-3">
            {MONTH_OPTIONS.map((m) => (
              <label
                key={m.value}
                className="flex items-center gap-1 text-theme-xs text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={months.includes(m.value)}
                  onChange={(e) =>
                    setMonths((ms) =>
                      e.target.checked
                        ? [...ms, m.value]
                        : ms.filter((x) => x !== m.value),
                    )
                  }
                />
                {m.label.slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>
        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Add slab"
        />
      </form>
    </Dialog>
  );
}

function LocationStates({ canWrite }: { canWrite: boolean }) {
  const locations = useWorkLocations(true);
  const states = usePtLocationStates();
  const setState = useSetPtLocationState();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const mapped = new Map(
    (states.data ?? []).map((s) => [s.workLocationId, s.stateCode]),
  );
  const rows = locations.data ?? [];

  async function save(workLocationId: number) {
    const code = (drafts[workLocationId] ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code))
      return setError("State code: 2–3 letters, e.g. TN");
    setError(null);
    try {
      await setState.mutateAsync({ workLocationId, stateCode: code });
      toast({ title: "PT state saved", variant: "success" });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card>
      <section
        aria-labelledby="pt-locations-heading"
        className="flex flex-col gap-3"
      >
        <h3
          id="pt-locations-heading"
          className="text-theme-md font-semibold text-gray-900 dark:text-white/90"
        >
          State of each work location
        </h3>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          A location without a state uses the default PT state (Policy tab).
        </p>
        <QueryState query={locations} area="work locations" />
        {locations.isSuccess && rows.length === 0 ? (
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            No work locations.
          </p>
        ) : null}
        {rows.length > 0 ? (
          <DataTable
            caption="Work location PT states"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              { header: "Work location", cell: (r) => r.name },
              {
                header: "PT state",
                cell: (r) => mapped.get(r.id) ?? "Default",
              },
              {
                header: "Change",
                cell: (r) =>
                  canWrite ? (
                    <div className="flex gap-2">
                      <Input
                        aria-label={`PT state of ${r.name}`}
                        className="w-20"
                        placeholder="TN"
                        value={drafts[r.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void save(r.id)}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
          />
        ) : null}
        <ServerError message={error} />
      </section>
    </Card>
  );
}

/** Professional Tax slabs per state and the state of each location (§3.5). */
export function ProfessionalTaxSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const query = usePtSlabs();
  const update = useUpdatePtSlab();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = query.data ?? [];

  async function deactivate(slab: PtSlab) {
    setError(null);
    try {
      await update.mutateAsync({ id: slab.id, body: { isActive: false } });
      toast({ title: "PT slab deactivated", variant: "success" });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info" title="Professional Tax">
        Turn PT on under Policy & statutory. Each month the slab of the
        employee&apos;s state whose range holds the month&apos;s gross earnings
        is deducted.
      </Alert>
      <Card>
        <div className="flex justify-end">
          {canWrite ? (
            <Button onClick={() => setCreating(true)}>New PT slab</Button>
          ) : null}
        </div>
      </Card>
      <QueryState query={query} area="PT slabs" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No PT slabs"
            description="Add the slabs of each state you pay PT in."
          />
        </Card>
      ) : null}
      {rows.length > 0 ? (
        <DataTable<PtSlab>
          caption="Professional Tax slabs"
          rows={rows}
          getRowKey={(r) => String(r.id)}
          columns={[
            { header: "State", cell: (r) => r.stateCode },
            {
              header: "Gross range",
              cell: (r) =>
                `${money(r.minMonthlyWage)} – ${r.maxMonthlyWage === null ? "no limit" : money(r.maxMonthlyWage)}`,
            },
            {
              header: "PT",
              cell: (r) =>
                `${money(r.monthlyAmount)}${r.specialMonth ? ` (${MONTH_OPTIONS[r.specialMonth - 1]?.label.slice(0, 3)}: ${money(r.specialAmount)})` : ""}`,
            },
            {
              header: "Months",
              cell: (r) =>
                r.applicableMonths.length === 0
                  ? "Every month"
                  : r.applicableMonths
                      .map((m) => MONTH_OPTIONS[m - 1]?.label.slice(0, 3))
                      .join(", "),
            },
            {
              header: "Effective",
              cell: (r) =>
                `${isoDate(r.effectiveFrom)} – ${r.effectiveTo ? isoDate(r.effectiveTo) : "open"}`,
            },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              header: "Actions",
              cell: (r) =>
                canWrite && r.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={update.isPending}
                    onClick={() => void deactivate(r)}
                  >
                    Deactivate
                  </Button>
                ) : null,
            },
          ]}
        />
      ) : null}
      <ServerError message={error} />
      <LocationStates canWrite={canWrite} />
      {creating ? <PtSlabDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
