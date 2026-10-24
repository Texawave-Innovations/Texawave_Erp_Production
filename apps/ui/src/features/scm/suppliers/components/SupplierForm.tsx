"use client";

import {
  SUPPLIER_STATUSES,
  type CreateSupplierInput,
  type Supplier,
  type SupplierStatus,
} from "@texawave-erp/api-types";
import {
  createSupplierSchema,
  GSTIN_REGEX,
  GST_STATE_CODES,
  INDIAN_STATES,
} from "@texawave-erp/core";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useMasterListItems } from "../../master-list-items/hooks";
import { useNextSupplierCode } from "../hooks";

interface FormState {
  supplierCode: string;
  companyName: string;
  type: string;
  status: SupplierStatus;
  gstin: string;
  pan: string;
  contactPerson: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  paymentTerms: string;
  creditLimit: string;
  currency: string;
  leadTimeDays: string;
  rating: string;
  notes: string;
}

const EMPTY: FormState = {
  supplierCode: "",
  companyName: "",
  type: "",
  status: "Active",
  gstin: "",
  pan: "",
  contactPerson: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  paymentTerms: "30 Days",
  creditLimit: "",
  currency: "INR",
  leadTimeDays: "",
  rating: "",
  notes: "",
};

function fromSupplier(s: Supplier): FormState {
  return {
    supplierCode: s.supplierCode,
    companyName: s.companyName,
    type: s.type ?? "",
    status: s.status,
    gstin: s.gstin ?? "",
    pan: s.pan ?? "",
    contactPerson: s.contactPerson,
    phone: s.phone ?? "",
    email: s.email ?? "",
    street: s.street ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    country: s.country ?? "India",
    pincode: s.pincode ?? "",
    paymentTerms: s.paymentTerms ?? "30 Days",
    creditLimit: Number(s.creditLimit) > 0 ? String(Number(s.creditLimit)) : "",
    currency: s.currency,
    leadTimeDays: s.leadTimeDays > 0 ? String(s.leadTimeDays) : "",
    rating: s.rating != null ? String(s.rating) : "",
    notes: s.notes ?? "",
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {children}
    </h3>
  );
}

export interface SupplierFormProps {
  supplier?: Supplier | null;
  onSubmit: (input: CreateSupplierInput) => Promise<void>;
  onCancel: () => void;
}

/** Legacy `ScmSupplierFormDialog`, same sections and rules: Basic Info, Tax,
 * Primary Contact, Address, Commercial, Other. A valid GSTIN auto-fills the
 * state from its first two digits; the supplier code is pre-filled with the
 * next VEND-NNNN on create. Validates with the shared zod schema and keeps
 * entered values when the server rejects the save. */
export function SupplierForm({
  supplier,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  const isEdit = Boolean(supplier);
  const [form, setForm] = useState<FormState>(
    supplier ? fromSupplier(supplier) : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [codeTouched, setCodeTouched] = useState(false);
  const nextCode = useNextSupplierCode(!isEdit);
  // Until the user edits it, a new supplier's code is the server's suggestion.
  const supplierCode =
    isEdit || codeTouched ? form.supplierCode : (nextCode.data ?? "");
  const supplierTypes = useMasterListItems({
    category: "supplier_type",
    page: 1,
    limit: 100,
  });
  const supplierTypeOptions = supplierTypes.data?.data ?? [];

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleGstinChange(raw: string) {
    const gstin = raw.toUpperCase().slice(0, 15);
    setForm((f) => {
      const mapped =
        gstin.length === 15 && GSTIN_REGEX.test(gstin)
          ? GST_STATE_CODES[gstin.slice(0, 2)]
          : undefined;
      return { ...f, gstin, state: mapped ?? f.state };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createSupplierSchema.safeParse({
      supplierCode,
      companyName: form.companyName,
      type: form.type,
      status: form.status,
      gstin: form.gstin,
      pan: form.pan,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      street: form.street,
      city: form.city,
      state: form.state,
      country: form.country,
      pincode: form.pincode,
      paymentTerms: form.paymentTerms,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : 0,
      currency: form.currency,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : 0,
      rating: form.rating ? Number(form.rating) : null,
      notes: form.notes,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save this supplier. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-3">
        <SectionTitle>Basic Information</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Supplier Code" required error={errors.supplierCode}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={supplierCode}
                onChange={(e) => {
                  setCodeTouched(true);
                  set("supplierCode", e.target.value);
                }}
                className="font-mono"
                disabled={disabled}
              />
            )}
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Company Name" required error={errors.companyName}>
              {(p) => (
                <Input
                  {...p}
                  invalid={p.invalid}
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder="ABC Suppliers Pvt Ltd"
                  disabled={disabled}
                />
              )}
            </FormField>
          </div>
          <FormField label="Supplier Type" error={errors.type}>
            {(p) => (
              <Select
                {...p}
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select a type</option>
                {supplierTypeOptions.map((t) => (
                  <option key={t.id} value={t.value}>
                    {t.value}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Status" error={errors.status}>
            {(p) => (
              <Select
                {...p}
                value={form.status}
                onChange={(e) =>
                  set("status", e.target.value as SupplierStatus)
                }
                disabled={disabled}
              >
                {SUPPLIER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Tax Information</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="GSTIN" error={errors.gstin}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="33AAAAA0000A1Z5"
                maxLength={15}
                className="font-mono uppercase"
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="PAN" error={errors.pan}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.pan}
                onChange={(e) =>
                  set("pan", e.target.value.toUpperCase().slice(0, 10))
                }
                placeholder="ABCDE1234F"
                maxLength={10}
                className="font-mono uppercase"
                disabled={disabled}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Primary Contact</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Contact Name" required error={errors.contactPerson}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.phone}
                inputMode="numeric"
                onChange={(e) =>
                  set("phone", e.target.value.replace(/\D/g, "").slice(0, 15))
                }
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Email" error={errors.email}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Address</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormField label="Address" error={errors.street}>
              {(p) => (
                <Input
                  {...p}
                  invalid={p.invalid}
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                  disabled={disabled}
                />
              )}
            </FormField>
          </div>
          <FormField label="City" error={errors.city}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="State" error={errors.state}>
            {(p) => (
              <Select
                {...p}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                disabled={disabled}
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Country" error={errors.country}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Postal Code" error={errors.pincode}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.pincode}
                inputMode="numeric"
                onChange={(e) =>
                  set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="font-mono"
                disabled={disabled}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Commercial</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Payment Terms" error={errors.paymentTerms}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.paymentTerms}
                onChange={(e) => set("paymentTerms", e.target.value)}
                placeholder="30 Days"
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Credit Limit" error={errors.creditLimit}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                type="number"
                min={0}
                value={form.creditLimit}
                onChange={(e) => set("creditLimit", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Currency" required error={errors.currency}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                value={form.currency}
                onChange={(e) =>
                  set("currency", e.target.value.toUpperCase().slice(0, 3))
                }
                placeholder="INR"
                disabled={disabled}
              />
            )}
          </FormField>
          <FormField label="Lead Time (days)" error={errors.leadTimeDays}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                type="number"
                min={0}
                value={form.leadTimeDays}
                onChange={(e) => set("leadTimeDays", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Other</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Rating (1-5, optional)" error={errors.rating}>
            {(p) => (
              <Input
                {...p}
                invalid={p.invalid}
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
                disabled={disabled}
              />
            )}
          </FormField>
          <div className="md:col-span-3">
            <FormField label="Notes" error={errors.notes}>
              {(p) => (
                <Textarea
                  {...p}
                  invalid={p.invalid}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  disabled={disabled}
                />
              )}
            </FormField>
          </div>
        </div>
      </section>

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
        <Button type="submit" loading={submitting}>
          {isEdit ? "Update Supplier" : "Create Supplier"}
        </Button>
      </div>
    </form>
  );
}
