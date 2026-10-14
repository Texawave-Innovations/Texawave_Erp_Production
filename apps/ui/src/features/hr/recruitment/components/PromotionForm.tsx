"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button, FormField, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  useCreateDesignation,
  useDesignations,
} from "@/features/designations/hooks";
import {
  designationCodeSchema,
  issuesByField,
  promotionFormSchema,
  toAmount,
  type PromotionFormValues,
} from "../schema";
import {
  convertAmount,
  monthlyTotal,
  round2,
  splitAmount,
  withDefined,
  type SalaryBasis,
} from "../salary";
import type { CreatePromotionLetterInput, PromotionLetterView } from "../types";
import { apiErrorMessage, formatRupees, todayDateOnly } from "../utils";

export interface PromotionEmployee {
  id: number;
  name: string;
  /** The employee's current master designation, shown as "previous". */
  designation: string;
}

/** What the form submits. `designationId` is left out on an edit that
 * did not change it. */
export type PromotionFormSubmit = Omit<
  CreatePromotionLetterInput,
  "designationId"
> & { designationId?: number };

export interface PromotionFormProps {
  /** The employee the letter is issued to (create). */
  employee?: PromotionEmployee;
  /** The existing letter being edited. Its employee cannot change. */
  initial?: PromotionLetterView;
  canReadDesignations: boolean;
  canAddDesignation: boolean;
  onSubmit: (input: PromotionFormSubmit) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Mirrored from promotion-letters.rules.ts (= the revision-letter defaults). */
const DEFAULTS = {
  location: "Chennai",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
} as const;

/** The master list is small; the API caps a page at 100. */
const DESIGNATION_PAGE = { limit: 100 } as const;

function firstOfNextMonth(): string {
  const now = new Date();
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return first.toISOString().slice(0, 10);
}

function valuesFrom(letter: PromotionLetterView): PromotionFormValues {
  return {
    employeeId: letter.employee.id,
    designationId: String(letter.designationId),
    location: letter.location,
    letterDate: letter.letterDate,
    effectiveDate: letter.effectiveDate,
    basic: letter.components.basic,
    da: letter.components.da,
    hra: letter.components.hra,
    ca: letter.components.ca,
    signatoryName: letter.signatoryName,
    signatoryDesignation: letter.signatoryDesignation,
  };
}

function emptyValues(employee: PromotionEmployee): PromotionFormValues {
  return {
    employeeId: employee.id,
    designationId: "",
    location: DEFAULTS.location,
    letterDate: todayDateOnly(),
    effectiveDate: firstOfNextMonth(),
    basic: "",
    da: "",
    hra: "",
    ca: "",
    signatoryName: DEFAULTS.signatoryName,
    signatoryDesignation: DEFAULTS.signatoryDesignation,
  };
}

/** Promotion letter form. Field names and limits follow CreatePromotionLetterDto;
 * the designation is picked from the designations master. */
export function PromotionForm({
  employee,
  initial,
  canReadDesignations,
  canAddDesignation,
  onSubmit,
  onCancel,
  submitLabel,
}: PromotionFormProps) {
  const [values, setValues] = useState<PromotionFormValues>(() => {
    if (initial) return valuesFrom(initial);
    if (employee) return emptyValues(employee);
    throw new Error("PromotionForm needs an employee or an initial letter");
  });
  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() =>
    initial ? round2(monthlyTotal(valuesFrom(initial))) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const designations = useDesignations(DESIGNATION_PAGE);
  const employeeName = initial?.employeeName ?? employee?.name ?? "";
  const previousDesignation =
    initial?.previousDesignation ?? employee?.designation ?? "";
  const monthlyNet = monthlyTotal(values);

  // Only active designations can be chosen. When editing a letter whose
  // designation was deactivated since, keep it listed so the select still
  // shows what the letter says; it is sent only if the user changes it.
  const options = (designations.data?.data ?? []).filter(
    (d) => d.isActive || (initial && d.id === initial.designationId),
  );

  function set<K extends keyof PromotionFormValues>(
    key: K,
    value: PromotionFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function applyAmount(next: string, nextBasis: SalaryBasis) {
    setAmount(next);
    setValues((prev) => ({ ...prev, ...splitAmount(next, nextBasis) }));
  }

  function switchBasis(next: SalaryBasis) {
    if (next === basis) return;
    setBasis(next);
    applyAmount(convertAmount(amount, next), next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = promotionFormSchema.safeParse(values);
    if (!result.success) {
      setErrors(issuesByField(result.error));
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const v = result.data;
      const designationId = Number(v.designationId);
      const designationChanged =
        !initial || designationId !== initial.designationId;
      await onSubmit({
        employeeId: v.employeeId,
        // On edit, an unchanged designation is not re-sent, so a letter whose
        // designation was deactivated later can still be edited.
        ...(designationChanged ? { designationId } : {}),
        location: v.location,
        letterDate: v.letterDate,
        effectiveDate: v.effectiveDate,
        ...withDefined("basic", toAmount(v.basic)),
        ...withDefined("da", toAmount(v.da)),
        ...withDefined("hra", toAmount(v.hra)),
        ...withDefined("ca", toAmount(v.ca)),
        signatoryName: v.signatoryName,
        signatoryDesignation: v.signatoryDesignation,
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.errorCode === "INVALID_DESIGNATION"
      ) {
        setErrors({
          designationId:
            "That designation is inactive or no longer exists. Pick another.",
        });
        void designations.refetch();
      } else {
        setSubmitError(
          apiErrorMessage(
            error,
            "Could not save the promotion letter. Try again.",
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const textField = (
    key: Exclude<keyof PromotionFormValues, "employeeId" | "designationId">,
    label: string,
    options: { required?: boolean; type?: string } = {},
  ) => (
    <FormField
      label={label}
      required={options.required ?? false}
      error={errors[key]}
    >
      {(fieldProps) => (
        <Input
          {...fieldProps}
          type={options.type ?? "text"}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          disabled={submitting}
        />
      )}
    </FormField>
  );

  let designationControl: React.ReactNode;
  if (!canReadDesignations) {
    designationControl = (
      <Alert variant="warning" title="Designation list unavailable">
        You do not have permission to view designations, so you cannot pick one
        here.
      </Alert>
    );
  } else {
    designationControl = (
      <FormField label="New designation" required error={errors.designationId}>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={values.designationId}
            onChange={(e) => set("designationId", e.target.value)}
            disabled={submitting || designations.isPending}
          >
            <option value="">
              {designations.isPending
                ? "Loading designations…"
                : designations.isError
                  ? "Could not load designations"
                  : "Select a designation"}
            </option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.isActive ? d.name : `${d.name} (inactive)`}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-theme-sm dark:border-gray-800 dark:bg-gray-800/50">
        <span className="text-gray-500 dark:text-gray-400">Employee: </span>
        <span className="font-medium text-gray-900 dark:text-white/90">
          {employeeName}
        </span>
        {initial ? (
          <span className="ml-2 text-theme-xs text-gray-500">
            {initial.documentNo}
          </span>
        ) : null}
      </div>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Designation</legend>
        <FormField label="Previous designation">
          {(fieldProps) => (
            <Input {...fieldProps} value={previousDesignation} readOnly />
          )}
        </FormField>
        <div className="flex flex-col gap-2">
          {designationControl}
          {canReadDesignations && canAddDesignation ? (
            <AddDesignation
              disabled={submitting}
              onAdded={(id) => {
                set("designationId", String(id));
                setErrors((prev) => {
                  const { designationId: _cleared, ...rest } = prev;
                  return rest;
                });
              }}
            />
          ) : null}
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Letter terms</legend>
        {textField("location", "Location", { required: true })}
        {textField("letterDate", "Letter date", { type: "date" })}
        {textField("effectiveDate", "Effective date", {
          required: true,
          type: "date",
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          New monthly salary (INR)
        </legend>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div
            role="group"
            aria-label="Salary basis"
            className="inline-flex shrink-0 rounded-lg border border-gray-300 p-0.5"
          >
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={basis === option}
                onClick={() => switchBasis(option)}
                disabled={submitting}
                className={`rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
                  basis === option
                    ? "bg-brand-500 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300"
                }`}
              >
                {option === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <FormField
              label={basis === "monthly" ? "Monthly salary" : "Annual salary"}
              hint="Splits into Basic 35%, DA 15%, HRA 30%, CA 20%. Components can still be edited below."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => applyAmount(e.target.value, basis)}
                  disabled={submitting}
                />
              )}
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {textField("basic", "Basic", { type: "number" })}
          {textField("da", "DA", { type: "number" })}
          {textField("hra", "HRA", { type: "number" })}
          {textField("ca", "CA", { type: "number" })}
        </div>

        <dl className="grid grid-cols-1 gap-2 rounded-lg border border-brand-200 bg-brand-25 p-4 text-theme-sm sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Gross monthly</dt>
            <dd className="font-semibold">
              {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Gross annual</dt>
            <dd className="font-semibold">
              {monthlyNet > 0
                ? formatRupees((monthlyNet * 12).toFixed(2))
                : "—"}
            </dd>
          </div>
        </dl>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Signatory</legend>
        {textField("signatoryName", "Signatory name", { required: true })}
        {textField("signatoryDesignation", "Signatory designation", {
          required: true,
        })}
      </fieldset>

      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          disabled={!canReadDesignations && !initial}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Inline "add to the master list" for a designation that does not exist yet.
 * Not a nested <form> (the promotion form is one), so Enter is handled here. */
function AddDesignation({
  disabled,
  onAdded,
}: {
  disabled: boolean;
  onAdded: (id: number) => void;
}) {
  const createDesignation = useCreateDesignation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setName("");
    setCode("");
    setError(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError("Name must be 1–100 characters");
      return;
    }
    const codeResult = designationCodeSchema.safeParse(code);
    if (!codeResult.success) {
      setError(`Code: ${codeResult.error.issues[0]?.message ?? "invalid"}`);
      return;
    }
    setError(null);
    try {
      const created = await createDesignation.mutateAsync({
        name: trimmed,
        code: codeResult.data.toUpperCase(),
      });
      onAdded(created.id);
      reset();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not add the designation."));
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        + Add designation
      </Button>
    );
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div
      role="group"
      aria-label="Add designation"
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
    >
      <FormField label="Designation name" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter}
            disabled={createDesignation.isPending}
            autoFocus
          />
        )}
      </FormField>
      <FormField label="Code" required hint="Letters, digits or _ (2–30)">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. TEAM_LEAD"
            onKeyDown={onEnter}
            disabled={createDesignation.isPending}
          />
        )}
      </FormField>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={reset}
          disabled={createDesignation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          loading={createDesignation.isPending}
        >
          Add designation
        </Button>
      </div>
    </div>
  );
}
