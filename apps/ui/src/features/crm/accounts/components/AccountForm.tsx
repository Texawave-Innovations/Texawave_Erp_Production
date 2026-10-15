"use client";

import {
  ACCOUNT_TYPES,
  BUSINESS_TYPES,
  createAccountSchema,
  type CreateAccountFormValues,
  CUSTOMER_CATEGORIES,
  CUSTOMER_CLASSES,
} from "@texawave-erp/core";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { useState } from "react";

export interface AccountFormProps {
  initialValues?: Partial<CreateAccountFormValues>;
  onSubmit: (values: CreateAccountFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Reproduces legacy `AccountFormDialog.tsx`'s 5-tab field grouping (Company
 * Info / Contact Details / Billing Address / Shipping Address / Business
 * Profile, + Tags) as stacked sections rather than nested tabs — only
 * `name` is required, matching legacy's own single client-side save guard.
 * Docs/CRM_FULL_LEGACY_PARITY.md §4. */
export function AccountForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: AccountFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [accountType, setAccountType] = useState(
    initialValues?.accountType ?? "",
  );
  const [ownerName, setOwnerName] = useState(initialValues?.ownerName ?? "");
  const [industry, setIndustry] = useState(initialValues?.industry ?? "");
  const [website, setWebsite] = useState(initialValues?.website ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [linkedin, setLinkedin] = useState(initialValues?.linkedin ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(
    initialValues?.registrationNumber ?? "",
  );
  const [numberOfEmployees, setNumberOfEmployees] = useState(
    initialValues?.numberOfEmployees?.toString() ?? "",
  );
  const [annualRevenue, setAnnualRevenue] = useState(
    initialValues?.annualRevenue?.toString() ?? "",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [billingStreet, setBillingStreet] = useState(
    initialValues?.billingStreet ?? "",
  );
  const [billingCity, setBillingCity] = useState(
    initialValues?.billingCity ?? "",
  );
  const [billingState, setBillingState] = useState(
    initialValues?.billingState ?? "",
  );
  const [billingPostalCode, setBillingPostalCode] = useState(
    initialValues?.billingPostalCode ?? "",
  );
  const [billingCountry, setBillingCountry] = useState(
    initialValues?.billingCountry ?? "",
  );
  const [shippingStreet, setShippingStreet] = useState(
    initialValues?.shippingStreet ?? "",
  );
  const [shippingCity, setShippingCity] = useState(
    initialValues?.shippingCity ?? "",
  );
  const [shippingState, setShippingState] = useState(
    initialValues?.shippingState ?? "",
  );
  const [shippingPostalCode, setShippingPostalCode] = useState(
    initialValues?.shippingPostalCode ?? "",
  );
  const [shippingCountry, setShippingCountry] = useState(
    initialValues?.shippingCountry ?? "",
  );
  const [customerCategory, setCustomerCategory] = useState(
    initialValues?.customerCategory ?? "",
  );
  const [customerClass, setCustomerClass] = useState(
    initialValues?.customerClass ?? "",
  );
  const [businessType, setBusinessType] = useState(
    initialValues?.businessType ?? "",
  );
  const [resellerType, setResellerType] = useState(
    initialValues?.resellerType ?? "",
  );
  const [tagsText, setTagsText] = useState(
    (initialValues?.tags ?? []).join(", "),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function copyBillingToShipping() {
    setShippingStreet(billingStreet);
    setShippingCity(billingCity);
    setShippingState(billingState);
    setShippingPostalCode(billingPostalCode);
    setShippingCountry(billingCountry);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const raw = {
      name,
      accountType: accountType || undefined,
      ownerName: ownerName || undefined,
      industry: industry || undefined,
      website: website || undefined,
      phone: phone || undefined,
      email: email || undefined,
      linkedin: linkedin || undefined,
      registrationNumber: registrationNumber || undefined,
      numberOfEmployees: numberOfEmployees
        ? Number(numberOfEmployees)
        : undefined,
      annualRevenue: annualRevenue ? Number(annualRevenue) : undefined,
      description: description || undefined,
      billingStreet: billingStreet || undefined,
      billingCity: billingCity || undefined,
      billingState: billingState || undefined,
      billingPostalCode: billingPostalCode || undefined,
      billingCountry: billingCountry || undefined,
      shippingStreet: shippingStreet || undefined,
      shippingCity: shippingCity || undefined,
      shippingState: shippingState || undefined,
      shippingPostalCode: shippingPostalCode || undefined,
      shippingCountry: shippingCountry || undefined,
      customerCategory: customerCategory || undefined,
      customerClass: customerClass || undefined,
      businessType: businessType || undefined,
      resellerType: resellerType || undefined,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const result = createAccountSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError(
        "Could not save this account. Check the fields above and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Company Info */}
      <section className="flex flex-col gap-4">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Company Info
        </h3>
        <FormField label="Account name" required error={errors.name}>
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Account type" error={errors.accountType}>
            {(fp) => (
              <Select
                {...fp}
                invalid={fp.invalid}
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                disabled={submitting}
              >
                <option value="">—</option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Owner" error={errors.ownerName}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Industry" error={errors.industry}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Website" error={errors.website}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <FormField label="Description" error={errors.description}>
          {(fp) => (
            <Textarea
              {...fp}
              invalid={fp.invalid}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          )}
        </FormField>
      </section>

      {/* Contact Details */}
      <section className="flex flex-col gap-4">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Contact Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone" error={errors.phone}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Email" error={errors.email}>
            {(fp) => (
              <Input
                {...fp}
                type="email"
                invalid={fp.invalid}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="LinkedIn" error={errors.linkedin}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField
            label="Registration number"
            error={errors.registrationNumber}
          >
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* Billing Address */}
      <section className="flex flex-col gap-4">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Billing Address
        </h3>
        <FormField label="Street" error={errors.billingStreet}>
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={billingStreet}
              onChange={(e) => setBillingStreet(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" error={errors.billingCity}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="State" error={errors.billingState}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={billingState}
                onChange={(e) => setBillingState(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Postal code" error={errors.billingPostalCode}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={billingPostalCode}
                onChange={(e) => setBillingPostalCode(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Country" error={errors.billingCountry}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={billingCountry}
                onChange={(e) => setBillingCountry(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* Shipping Address */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Shipping Address
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyBillingToShipping}
            disabled={submitting}
          >
            Same as billing
          </Button>
        </div>
        <FormField label="Street" error={errors.shippingStreet}>
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={shippingStreet}
              onChange={(e) => setShippingStreet(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" error={errors.shippingCity}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="State" error={errors.shippingState}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Postal code" error={errors.shippingPostalCode}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={shippingPostalCode}
                onChange={(e) => setShippingPostalCode(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Country" error={errors.shippingCountry}>
            {(fp) => (
              <Input
                {...fp}
                invalid={fp.invalid}
                value={shippingCountry}
                onChange={(e) => setShippingCountry(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* Business Profile */}
      <section className="flex flex-col gap-4">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Business Profile
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Employees" error={errors.numberOfEmployees}>
            {(fp) => (
              <Input
                {...fp}
                type="number"
                min={0}
                invalid={fp.invalid}
                value={numberOfEmployees}
                onChange={(e) => setNumberOfEmployees(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
          <FormField label="Annual revenue" error={errors.annualRevenue}>
            {(fp) => (
              <Input
                {...fp}
                type="number"
                min={0}
                invalid={fp.invalid}
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Customer category" error={errors.customerCategory}>
            {(fp) => (
              <Select
                {...fp}
                invalid={fp.invalid}
                value={customerCategory}
                onChange={(e) => setCustomerCategory(e.target.value)}
                disabled={submitting}
              >
                <option value="">—</option>
                {CUSTOMER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Customer class" error={errors.customerClass}>
            {(fp) => (
              <Select
                {...fp}
                invalid={fp.invalid}
                value={customerClass}
                onChange={(e) => setCustomerClass(e.target.value)}
                disabled={submitting}
              >
                <option value="">—</option>
                {CUSTOMER_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Business type" error={errors.businessType}>
            {(fp) => (
              <Select
                {...fp}
                invalid={fp.invalid}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                disabled={submitting}
              >
                <option value="">—</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormField label="Reseller type" error={errors.resellerType}>
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={resellerType}
              onChange={(e) => setResellerType(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      {/* Tags */}
      <section className="flex flex-col gap-4">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Tags
        </h3>
        <FormField
          label="Tags (comma-separated)"
          error={errors.tags}
          hint="e.g. vip, renewal-2026"
        >
          {(fp) => (
            <Input
              {...fp}
              invalid={fp.invalid}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </section>

      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
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
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
