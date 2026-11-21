"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError, CALLING_CODES, mobileMaxLength } from "@texawave-erp/core";
import {
  AddressDialog,
  Alert,
  Button,
  EmptyState,
  FormField,
  Input,
  SectionCard,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
} from "@texawave-erp/ui-kit";
import { fromGstin, GST_STATES } from "../../shared/gst";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useNextCustomerCode } from "../hooks";
import {
  addressSchema,
  customerFormSchema,
  emptyAddress,
  type AddressFormValues,
  type CustomerFormValues,
} from "../schema";

/** API business errors → the field they belong to. */
const FIELD_OF_ERROR: Record<string, string> = {
  CUSTOMER_GSTIN_EXISTS: "gstin",
  INVALID_GSTIN: "gstin",
  PAN_GSTIN_MISMATCH: "pan",
  INVALID_STATE_CODE: "stateCode",
  MULTIPLE_DEFAULT_ADDRESSES: "addresses",
};

const ADDRESS_FIELDS = [
  "label",
  "street",
  "area",
  "city",
  "stateCode",
  "pincode",
  "country",
] as const;

type AddressTab = AddressFormValues["addressType"];

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to save customers.";
    }
    if (error.isValidationError) {
      return `The server rejected some values: ${error.fieldErrors.join("; ")}`;
    }
    return error.message;
  }
  return "Could not save the customer. Check the fields and try again.";
}

/** The address dialog's field errors, from the same schema the form uses. */
function validateAddress(a: AddressFormValues): Record<string, string> {
  const result = addressSchema.safeParse(a);
  const errors: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key) errors[key] ??= issue.message;
    }
  }
  return errors;
}

export interface CustomerFormProps {
  mode: "create" | "edit";
  initialValues: CustomerFormValues;
  /** Edit: the issued code (never changes). */
  customerCode?: string;
  /** Edit: the stored, masked account number. */
  maskedAccount?: string | null;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  onCancel: () => void;
}

export function CustomerForm({
  mode,
  initialValues,
  customerCode,
  maskedAccount,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(initialValues);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tab, setTab] = useState<AddressTab>("BILLING");
  /** The address being added (`index: null`) or edited. */
  const [editing, setEditing] = useState<{
    index: number | null;
    value: AddressFormValues;
  } | null>(null);
  const schema = useMemo(
    () =>
      customerFormSchema({ mode, hasStoredAccount: Boolean(maskedAccount) }),
    [mode, maskedAccount],
  );
  // Each field is checked when it is left; errors show in a bubble under it.
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(schema, values);
  const [submitting, setSubmitting] = useState(false);
  const nextCode = useNextCustomerCode(
    values.mobileCountryCode,
    mode === "create",
  );

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  );
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);

  function set<K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) {
    changed(key);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setGstin(raw: string) {
    changed("gstin");
    const gstin = raw.toUpperCase();
    const derived = fromGstin(gstin);
    setValues((v) => ({
      ...v,
      gstin,
      // A full GSTIN fills in its state and PAN; both stay editable.
      ...(derived ? { stateCode: derived.stateCode, pan: derived.pan } : {}),
    }));
  }

  function openAddAddress() {
    const fresh = emptyAddress(tab);
    setEditing({
      index: null,
      // The first address of a type becomes its default.
      value: {
        ...fresh,
        isDefault: !values.addresses.some((a) => a.addressType === tab),
      },
    });
  }

  function saveAddress(saved: AddressFormValues) {
    if (!editing) return;
    changed("addresses");
    setValues((v) => {
      const list =
        editing.index === null
          ? [...v.addresses, saved]
          : v.addresses.map((a, i) => (i === editing.index ? saved : a));
      return {
        ...v,
        // One default per type: choosing one clears the others.
        addresses: list.map((a, i) =>
          saved.isDefault &&
          a.addressType === saved.addressType &&
          i !== (editing.index ?? list.length - 1)
            ? { ...a, isDefault: false }
            : a,
        ),
      };
    });
    setTab(saved.addressType);
    setEditing(null);
  }

  function removeAddress(index: number) {
    changed("addresses");
    setValues((v) => ({
      ...v,
      addresses: v.addresses.filter((_, j) => j !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateAll()) {
      setServerError("Fix the highlighted fields and try again.");
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELD_OF_ERROR[error.errorCode] : undefined;
      if (field && error instanceof ApiError) {
        setServerErrors({ [field]: error.message });
      }
      setServerError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const text = (
    key: keyof CustomerFormValues,
    label: string,
    opts: {
      required?: boolean;
      placeholder?: string;
      hint?: string;
      type?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      maxLength?: number;
    } = {},
  ) => (
    <FormField
      errorVariant="bubble"
      label={label}
      required={opts.required ?? false}
      error={errorFor(key)}
      {...(opts.hint ? { hint: opts.hint } : {})}
    >
      {(f) => (
        <Input
          {...f}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          maxLength={opts.maxLength}
          placeholder={opts.placeholder}
          value={values[key] as string}
          disabled={submitting}
          onBlur={() => touch(key)}
          onChange={(e) => set(key, e.target.value as never)}
        />
      )}
    </FormField>
  );

  const countOf = (type: AddressTab) =>
    values.addresses.filter((a) => a.addressType === type).length;
  const kindWord = tab === "BILLING" ? "billing" : "shipping";
  const codeShown = mode === "create" ? nextCode.data : customerCode;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
      aria-label={mode === "create" ? "New customer" : "Edit customer"}
    >
      {serverError ? (
        <Alert variant="error" title="Customer not saved">
          {serverError}
        </Alert>
      ) : null}

      <SectionCard
        title="Basic & tax information"
        description={
          mode === "create"
            ? "The customer code is issued on save; its country comes from the mobile country code."
            : "The customer code never changes."
        }
        action={
          codeShown ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-theme-xs font-semibold text-white">
              {mode === "create" ? "Next code" : "Customer code"}: {codeShown}
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {text("companyName", "Company name", {
            maxLength: 200,
            required: true,
            placeholder: "ABC Industries Pvt Ltd",
          })}
          {text("contactPerson", "Contact person", {
            required: true,
            maxLength: 150,
          })}
          {text("email", "Email", {
            required: true,
            type: "email",
            maxLength: 254,
          })}
          <div className="grid grid-cols-[minmax(0,8rem)_1fr] gap-2">
            <FormField
              errorVariant="bubble"
              label="Country code"
              error={errorFor("mobileCountryCode")}
            >
              {(f) => (
                <Select
                  {...f}
                  value={values.mobileCountryCode}
                  disabled={submitting}
                  onBlur={() => touch("mobileCountryCode")}
                  onChange={(e) => set("mobileCountryCode", e.target.value)}
                >
                  {CALLING_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} {c.country}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {text("mobileNumber", "Mobile number", {
              maxLength: mobileMaxLength(values.mobileCountryCode),
              required: true,
              inputMode: "numeric",
            })}
          </div>
          <FormField
            errorVariant="bubble"
            label="GSTIN"
            error={errorFor("gstin")}
            hint="State and PAN are filled from the GSTIN."
          >
            {(f) => (
              <Input
                {...f}
                placeholder="33ABCDE1234F1Z5"
                maxLength={15}
                value={values.gstin}
                disabled={submitting}
                onBlur={() => touch("gstin")}
                onChange={(e) => setGstin(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            errorVariant="bubble"
            label="State"
            error={errorFor("stateCode")}
            hint="Auto-detected from the GSTIN; you can change it."
          >
            {(f) => (
              <Select
                {...f}
                value={values.stateCode}
                disabled={submitting}
                onBlur={() => touch("stateCode")}
                onChange={(e) => set("stateCode", e.target.value)}
              >
                <option value="">Not set</option>
                {GST_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {text("cgstRate", "CGST rate (%)", {
            inputMode: "decimal",
            maxLength: 6,
          })}
          {text("sgstRate", "SGST rate (%)", {
            inputMode: "decimal",
            maxLength: 6,
          })}
          {text("igstRate", "IGST rate (%)", {
            inputMode: "decimal",
            maxLength: 6,
          })}
          {text("pan", "PAN", { placeholder: "ABCDE1234F", maxLength: 10 })}
          {text("cin", "CIN", {
            placeholder: "L12345MH2020PLC123456",
            maxLength: 21,
          })}
          <FormField
            errorVariant="bubble"
            label="Status"
            error={errorFor("status")}
          >
            {(f) => (
              <Select
                {...f}
                value={values.status}
                disabled={submitting}
                onChange={(e) =>
                  set("status", e.target.value as CustomerFormValues["status"])
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            )}
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Billing & shipping addresses"
        description="One default billing and one default shipping address."
      >
        {errorFor("addresses") ? (
          <p role="alert" className="text-theme-sm text-error-600">
            {errorFor("addresses")}
          </p>
        ) : null}
        <Tabs<AddressTab>
          label="Address type"
          idPrefix="customer-address"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "BILLING", label: `Billing (${countOf("BILLING")})` },
            { id: "SHIPPING", label: `Shipping (${countOf("SHIPPING")})` },
          ]}
        >
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={submitting || values.addresses.length >= 50}
                onClick={openAddAddress}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Add {kindWord} address
              </Button>
            </div>
            {countOf(tab) === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 pt-6 dark:border-gray-700">
                <MapPin
                  className="h-8 w-8 text-gray-500 dark:text-gray-400"
                  aria-hidden="true"
                />
                <EmptyState title={`No ${kindWord} addresses added yet`} />
              </div>
            ) : (
              values.addresses.map((a, i) => {
                if (a.addressType !== tab) return null;
                const invalid = ADDRESS_FIELDS.some((f) =>
                  errorFor(`addresses.${i}.${f}`),
                );
                const state = GST_STATES.find((s) => s.code === a.stateCode);
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white/90">
                          {a.label}
                        </p>
                        {a.isDefault ? (
                          <StatusBadge label="Default" colorToken="success" />
                        ) : null}
                      </div>
                      <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                        {[a.street, a.area, a.city, state?.name, a.pincode]
                          .filter(Boolean)
                          .join(", ")}{" "}
                        · {a.country}
                      </p>
                      {invalid ? (
                        <p
                          role="alert"
                          className="text-theme-sm text-error-600"
                        >
                          Some details are invalid. Edit this address to fix
                          them.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        aria-label={`Edit address ${a.label}`}
                        onClick={() => setEditing({ index: i, value: a })}
                      >
                        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        aria-label={`Remove address ${a.label}`}
                        onClick={() => removeAddress(i)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Tabs>
      </SectionCard>

      <SectionCard
        title="Bank details (optional)"
        description="The account number is stored encrypted; only its last digits are shown afterwards."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {text("bankName", "Bank name", { maxLength: 150 })}
          {text("bankAccountNumber", "Account number", {
            maxLength: 18,
            inputMode: "numeric",
            ...(mode === "edit"
              ? {
                  hint: maskedAccount
                    ? `Stored: ${maskedAccount}. Leave blank to keep it.`
                    : "Leave blank to keep it empty.",
                }
              : {}),
          })}
          {text("bankIfsc", "IFSC code", {
            placeholder: "HDFC0001234",
            maxLength: 11,
          })}
          {text("bankBranch", "Branch", { maxLength: 150 })}
        </div>
        <FormField
          errorVariant="bubble"
          label="Payment notes"
          error={errorFor("paymentNotes")}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              placeholder="Additional payment notes, UPI ID, etc."
              value={values.paymentNotes}
              disabled={submitting}
              onBlur={() => touch("paymentNotes")}
              onChange={(e) => set("paymentNotes", e.target.value)}
            />
          )}
        </FormField>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "Create customer" : "Save changes"}
        </Button>
      </div>

      <AddressDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        mode={editing?.index === null ? "add" : "edit"}
        value={editing?.value ?? emptyAddress(tab)}
        states={GST_STATES}
        validate={validateAddress}
        onSave={saveAddress}
      />
    </form>
  );
}
