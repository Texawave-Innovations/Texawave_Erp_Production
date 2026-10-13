"use client";

import {
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { TemplateLineBody } from "../api";
import { describeError, money } from "../format";
import {
  useSalaryComponents,
  useSalaryTemplates,
  useSaveSalaryComponent,
  useSaveSalaryTemplate,
  useTemplatePreview,
} from "../hooks";
import { PAYROLL_SETTINGS_WRITE } from "../permissions";
import {
  CALCULATION_TYPES,
  type CalculationType,
  type ComponentKind,
  type SalaryComponent,
  type SalaryTemplate,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const FLAG_LABEL = {
  isProrated: "Reduced for loss of pay",
  isTaxable: "Taxable (TDS)",
  pfApplicable: "Part of the PF wage",
  esiApplicable: "Part of the ESI wage",
} as const;
type Flag = keyof typeof FLAG_LABEL;

const CALC_LABEL: Record<CalculationType, string> = {
  FIXED: "Fixed ₹",
  PERCENT_OF_GROSS: "% of gross",
  PERCENT_OF_BASIC: "% of Basic",
  REMAINDER: "Remainder of gross",
};

function CheckLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-theme-sm text-gray-700 dark:text-gray-300">
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

// ---- components -------------------------------------------------------------

function ComponentDialog({
  component,
  onClose,
}: {
  component: SalaryComponent | null;
  onClose: () => void;
}) {
  const save = useSaveSalaryComponent();
  const { toast } = useToast();
  const [code, setCode] = useState(component?.code ?? "");
  const [name, setName] = useState(component?.name ?? "");
  const [kind, setKind] = useState<ComponentKind>(component?.kind ?? "EARNING");
  const [order, setOrder] = useState(String(component?.displayOrder ?? 100));
  const [flags, setFlags] = useState<Record<Flag, boolean>>({
    isProrated: component?.isProrated ?? true,
    isTaxable: component?.isTaxable ?? true,
    pfApplicable: component?.pfApplicable ?? false,
    esiApplicable: component?.esiApplicable ?? true,
  });
  const [active, setActive] = useState(component?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!component && !/^[A-Z][A-Z0-9_]{1,39}$/.test(code.trim().toUpperCase()))
      next.code =
        "Upper-case letters, digits and _ (2–40), starting with a letter";
    if (name.trim().length < 2) next.name = "Give a name";
    if (!Number.isInteger(Number(order))) next.order = "A whole number";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setServerError(null);
    try {
      await save.mutateAsync({
        id: component?.id ?? null,
        body: {
          ...(component
            ? { isActive: active }
            : { code: code.trim().toUpperCase(), kind }),
          name: name.trim(),
          displayOrder: Number(order),
          ...flags,
        },
      });
      toast({
        title: component ? "Component updated" : "Component added",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={component ? `Edit ${component.code}` : "New component"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Code"
            required
            hint={component ? "Fixed once created." : "e.g. SHIFT_ALLOWANCE"}
            error={errors.code}
          >
            {(f) => (
              <Input
                {...f}
                disabled={Boolean(component)}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Name" required error={errors.name}>
            {(f) => (
              <Input
                {...f}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Kind"
            hint={component ? "Fixed once created." : undefined}
          >
            {(f) => (
              <Select
                {...f}
                disabled={Boolean(component)}
                value={kind}
                onChange={(e) => setKind(e.target.value as ComponentKind)}
              >
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </Select>
            )}
          </FormField>
          <FormField label="Display order" error={errors.order}>
            {(f) => (
              <Input
                {...f}
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            How payroll treats it
          </legend>
          {(Object.keys(FLAG_LABEL) as Flag[]).map((k) => (
            <CheckLine
              key={k}
              label={FLAG_LABEL[k]}
              checked={flags[k]}
              onChange={(v) => setFlags((f) => ({ ...f, [k]: v }))}
            />
          ))}
          {component ? (
            <CheckLine
              label="Active (usable in new salaries)"
              checked={active}
              onChange={setActive}
            />
          ) : null}
        </fieldset>
        <ServerError message={serverError} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel={component ? "Save" : "Add component"}
        />
      </form>
    </Dialog>
  );
}

/** The salary component master (Docs/PAYROLL_AND_COMPLIANCE.md §3.0). */
export function ComponentsSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<SalaryComponent | "new" | null>(null);
  const query = useSalaryComponents(showInactive);
  const rows = query.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CheckLine
            label="Show inactive"
            checked={showInactive}
            onChange={setShowInactive}
          />
          {canWrite ? (
            <Button onClick={() => setEditing("new")}>New component</Button>
          ) : null}
        </div>
      </Card>
      <QueryState query={query} area="salary components" />
      {query.isSuccess ? (
        <DataTable<SalaryComponent>
          caption="Salary components"
          rows={rows}
          getRowKey={(r) => String(r.id)}
          columns={[
            {
              header: "Component",
              cell: (r) => (
                <div className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-theme-xs text-gray-500">
                    {r.code}
                    {r.isSystem ? " · system" : ""}
                  </span>
                </div>
              ),
            },
            {
              header: "Kind",
              cell: (r) => (r.kind === "EARNING" ? "Earning" : "Deduction"),
            },
            {
              header: "Treatment",
              cell: (r) =>
                (Object.keys(FLAG_LABEL) as Flag[])
                  .filter((k) => r[k])
                  .map((k) => FLAG_LABEL[k])
                  .join(" · ") || "—",
            },
            { header: "Order", cell: (r) => r.displayOrder },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              header: "Actions",
              cell: (r) =>
                canWrite ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Edit component ${r.code}`}
                    onClick={() => setEditing(r)}
                  >
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />
      ) : null}
      {editing ? (
        <ComponentDialog
          component={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

// ---- templates --------------------------------------------------------------

interface DraftLine {
  key: number;
  componentId: number | "";
  calculationType: CalculationType;
  value: string;
}
let lineKey = 1;

function TemplateDialog({
  template,
  onClose,
}: {
  template: SalaryTemplate | null;
  onClose: () => void;
}) {
  const save = useSaveSalaryTemplate();
  const components = useSalaryComponents(false);
  const { toast } = useToast();
  const [code, setCode] = useState(template?.code ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [active, setActive] = useState(template?.isActive ?? true);
  const [lines, setLines] = useState<DraftLine[]>(
    template?.lines.map((l) => ({
      key: lineKey++,
      componentId: l.component.id,
      calculationType: l.calculationType,
      value: l.calculationType === "REMAINDER" ? "" : String(Number(l.value)),
    })) ?? [
      {
        key: lineKey++,
        componentId: "",
        calculationType: "PERCENT_OF_GROSS",
        value: "",
      },
    ],
  );
  const [previewGross, setPreviewGross] = useState("");
  const preview = useTemplatePreview(
    template?.id ?? null,
    Number(previewGross) || 0,
  );
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !template &&
      !/^[A-Z][A-Z0-9_-]{1,39}$/.test(code.trim().toUpperCase())
    ) {
      setError("Code: upper-case letters, digits, _ or - (2–40)");
      return;
    }
    if (name.trim().length < 2) return setError("Give the template a name");
    const body: TemplateLineBody[] = [];
    for (const l of lines) {
      if (l.componentId === "")
        return setError("Choose a component on every line");
      if (
        l.calculationType !== "REMAINDER" &&
        !(Number(l.value) >= 0 && l.value !== "")
      )
        return setError("Every line except the remainder needs a value");
      body.push({
        componentId: l.componentId,
        calculationType: l.calculationType,
        ...(l.calculationType === "REMAINDER"
          ? {}
          : { value: Number(l.value) }),
      });
    }
    if (body.filter((l) => l.calculationType === "REMAINDER").length > 1)
      return setError("Only one line can take the remainder");
    setError(null);
    try {
      await save.mutateAsync({
        id: template?.id ?? null,
        body: {
          ...(template
            ? { isActive: active }
            : { code: code.trim().toUpperCase() }),
          name: name.trim(),
          description: description.trim(),
          lines: body,
        },
      });
      toast({
        title: template ? "Template updated" : "Template created",
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
      title={
        template ? `Edit template ${template.code}` : "New salary template"
      }
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Code"
            required
            hint={template ? "Fixed once created." : "e.g. GRADE-A"}
          >
            {(f) => (
              <Input
                {...f}
                disabled={Boolean(template)}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Name" required>
            {(f) => (
              <Input
                {...f}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Description" hint="Optional.">
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
            Lines — worked out as fixed / % of gross, then % of Basic, then the
            remainder
          </legend>
          {lines.map((l, i) => (
            <div key={l.key} className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Component of template line ${i + 1}`}
                className="min-w-0 flex-1 sm:w-56 sm:flex-none"
                value={l.componentId}
                onChange={(e) =>
                  update(l.key, {
                    componentId: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">Choose a component</option>
                {(components.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`Calculation of template line ${i + 1}`}
                className="w-44"
                value={l.calculationType}
                onChange={(e) =>
                  update(l.key, {
                    calculationType: e.target.value as CalculationType,
                  })
                }
              >
                {CALCULATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CALC_LABEL[t]}
                  </option>
                ))}
              </Select>
              {l.calculationType !== "REMAINDER" ? (
                <Input
                  aria-label={`Value of template line ${i + 1}`}
                  className="w-28"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={l.value}
                  onChange={(e) => update(l.key, { value: e.target.value })}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove template line ${i + 1}`}
                onClick={() =>
                  setLines((ls) => ls.filter((x) => x.key !== l.key))
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
              onClick={() =>
                setLines((ls) => [
                  ...ls,
                  {
                    key: lineKey++,
                    componentId: "",
                    calculationType: "FIXED",
                    value: "",
                  },
                ])
              }
            >
              Add line
            </Button>
          </div>
        </fieldset>
        {template ? (
          <CheckLine
            label="Active (offered for new salaries)"
            checked={active}
            onChange={setActive}
          />
        ) : null}
        {template ? (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <FormField label="Preview the saved template for a gross of (₹)">
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={1}
                  className="w-44"
                  value={previewGross}
                  onChange={(e) => setPreviewGross(e.target.value)}
                />
              )}
            </FormField>
            {preview.data ? (
              <ul className="text-theme-sm">
                {preview.data.lines.map((l) => (
                  <li key={l.componentId} className="flex justify-between">
                    <span>{l.code}</span>
                    <span>{money(l.monthlyAmount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.isError ? (
              <ServerError message={describeError(preview.error)} />
            ) : null}
          </div>
        ) : null}
        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel={template ? "Save template" : "Create template"}
        />
      </form>
    </Dialog>
  );
}

/** Salary templates — a breakup per grade (§3.0, §4.10). */
export function TemplatesSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<SalaryTemplate | "new" | null>(null);
  const query = useSalaryTemplates(showInactive);
  const rows = query.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CheckLine
            label="Show inactive"
            checked={showInactive}
            onChange={setShowInactive}
          />
          {canWrite ? (
            <Button onClick={() => setEditing("new")}>New template</Button>
          ) : null}
        </div>
      </Card>
      <QueryState query={query} area="salary templates" />
      {query.isSuccess && rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No templates"
            description="A template is a salary breakup (e.g. per grade) applied to a gross amount."
          />
        </Card>
      ) : null}
      {query.isSuccess && rows.length > 0 ? (
        <DataTable<SalaryTemplate>
          caption="Salary templates"
          rows={rows}
          getRowKey={(r) => String(r.id)}
          columns={[
            {
              header: "Template",
              cell: (r) => (
                <div className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-theme-xs text-gray-500">{r.code}</span>
                </div>
              ),
            },
            {
              header: "Lines",
              cell: (r) => (
                <ul className="text-theme-xs">
                  {r.lines.map((l) => (
                    <li key={l.id}>
                      {l.component.code}:{" "}
                      {l.calculationType === "REMAINDER"
                        ? "remainder"
                        : l.calculationType === "FIXED"
                          ? money(l.value)
                          : `${Number(l.value)}% of ${l.calculationType === "PERCENT_OF_GROSS" ? "gross" : "Basic"}`}
                    </li>
                  ))}
                </ul>
              ),
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
                canWrite ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Edit template ${r.code}`}
                    onClick={() => setEditing(r)}
                  >
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />
      ) : null}
      {editing ? (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
