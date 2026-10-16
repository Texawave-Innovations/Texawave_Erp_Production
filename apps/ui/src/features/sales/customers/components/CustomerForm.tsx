"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiError, CALLING_CODES, mobileMaxLength } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { fromGstin, GST_STATES } from "../../shared/gst";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useNextCustomerCode } from "../hooks";
import {
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          {title}
        </h2>
        {description ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </Card>
  );
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

  function setAddress(index: number, patch: Partial<AddressFormValues>) {
    for (const k of Object.keys(patch)) changed(`addresses.${index}.${k}`);
    setValues((v) => ({
      ...v,
      addresses: v.addresses.map((a, i) =>
        i === index ? { ...a, ...patch } : a,
      ),
    }));
  }

  function setDefaultAddress(index: number, isDefault: boolean) {
    setValues((v) => {
      const type = v.addresses[index]?.addressType;
      return {
        ...v,
        addresses: v.addresses.map((a, i) =>
          i === index
            ? { ...a, isDefault }
            : // One default per type: choosing one clears the others.
              isDefault && a.addressType === type
              ? { ...a, isDefault: false }
              : a,
        ),
      };
    });
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

      <Section
        title="Company"
        description={
          mode === "create"
            ? `The customer code is issued on save${
                nextCode.data ? ` — next: ${nextCode.data}` : ""
              }. Its country comes from the mobile country code.`
            : `Customer code ${customerCode ?? ""} (never changes).`
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
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
      </Section>

      <Section
        title="Tax details"
        description="A full GSTIN fills in the state and PAN. GST rates are optional and have no defaults."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            errorVariant="bubble"
            label="GSTIN"
            error={errorFor("gstin")}
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
          {text("pan", "PAN", { placeholder: "ABCDE1234F", maxLength: 10 })}
          {text("cin", "CIN", {
            placeholder: "L12345MH2020PLC123456",
            maxLength: 21,
          })}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {text("cgstRate", "CGST %", { inputMode: "decimal", maxLength: 6 })}
          {text("sgstRate", "SGST %", { inputMode: "decimal", maxLength: 6 })}
          {text("igstRate", "IGST %", { inputMode: "decimal", maxLength: 6 })}
        </div>
      </Section>

      <Section
        title="Bank details"
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
          {text("bankIfsc", "IFSC", {
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
              placeholder="e.g. UPI: abc@hdfcbank"
              value={values.paymentNotes}
              disabled={submitting}
              onBlur={() => touch("paymentNotes")}
              onChange={(e) => set("paymentNotes", e.target.value)}
            />
          )}
        </FormField>
      </Section>

      <Section
        title="Addresses"
        description="One default billing and one default shipping address."
      >
        {errorFor("addresses") ? (
          <p role="alert" className="text-theme-sm text-error-600">
            {errorFor("addresses")}
          </p>
        ) : null}
        {values.addresses.length === 0 ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            No addresses yet.
          </p>
        ) : null}
        {values.addresses.map((a, i) => {
          const err = (field: string) => errorFor(`addresses.${i}.${field}`);
          return (
            <fieldset
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <legend className="px-1 text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
                Address {i + 1}
              </legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField errorVariant="bubble" label="Type">
                  {(f) => (
                    <Select
                      {...f}
                      value={a.addressType}
                      disabled={submitting}
                      onChange={(e) =>
                        setAddress(i, {
                          addressType: e.target
                            .value as AddressFormValues["addressType"],
                          isDefault: false,
                        })
                      }
                    >
                      <option value="BILLING">Billing</option>
                      <option value="SHIPPING">Shipping</option>
                    </Select>
                  )}
                </FormField>
                <FormField
                  errorVariant="bubble"
                  label="Label"
                  required
                  error={err("label")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      value={a.label}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.label`)}
                      onChange={(e) => setAddress(i, { label: e.target.value })}
                    />
                  )}
                </FormField>
                <FormField
                  errorVariant="bubble"
                  label="City"
                  required
                  error={err("city")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      value={a.city}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.city`)}
                      onChange={(e) => setAddress(i, { city: e.target.value })}
                    />
                  )}
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  errorVariant="bubble"
                  label="Street"
                  required
                  error={err("street")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      value={a.street}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.street`)}
                      onChange={(e) =>
                        setAddress(i, { street: e.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  errorVariant="bubble"
                  label="Area"
                  error={err("area")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      value={a.area}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.area`)}
                      onChange={(e) => setAddress(i, { area: e.target.value })}
                    />
                  )}
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField
                  errorVariant="bubble"
                  label="State"
                  required
                  error={err("stateCode")}
                >
                  {(f) => (
                    <Select
                      {...f}
                      value={a.stateCode}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.stateCode`)}
                      onChange={(e) =>
                        setAddress(i, { stateCode: e.target.value })
                      }
                    >
                      <option value="">Choose a state</option>
                      {GST_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField
                  errorVariant="bubble"
                  label="Pincode"
                  required
                  error={err("pincode")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      inputMode="numeric"
                      maxLength={6}
                      value={a.pincode}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.pincode`)}
                      onChange={(e) =>
                        setAddress(i, { pincode: e.target.value })
                      }
                    />
                  )}
                </FormField>
                <FormField
                  errorVariant="bubble"
                  label="Country"
                  required
                  error={err("country")}
                >
                  {(f) => (
                    <Input
                      {...f}
                      value={a.country}
                      disabled={submitting}
                      onBlur={() => touch(`addresses.${i}.country`)}
                      onChange={(e) =>
                        setAddress(i, { country: e.target.value })
                      }
                    />
                  )}
                </FormField>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
                  <Checkbox
                    checked={a.isDefault}
                    disabled={submitting}
                    onChange={(e) => setDefaultAddress(i, e.target.checked)}
                  />
                  Default {a.addressType === "BILLING" ? "billing" : "shipping"}{" "}
                  address
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  aria-label={`Remove address ${i + 1}`}
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      addresses: v.addresses.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </fieldset>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {(["BILLING", "SHIPPING"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant="secondary"
              size="sm"
              disabled={submitting || values.addresses.length >= 50}
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  addresses: [...v.addresses, emptyAddress(type)],
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add {type === "BILLING" ? "billing" : "shipping"} address
            </Button>
          ))}
        </div>
      </Section>

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
    </form>
  );
}
