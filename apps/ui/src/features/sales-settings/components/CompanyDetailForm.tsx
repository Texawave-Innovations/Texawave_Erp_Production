"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useCompanyDetail, useUpsertCompanyDetail } from "../hooks";
import { COMPANY_DETAIL_READ, COMPANY_DETAIL_WRITE } from "../permissions";
import {
  sanitizeCode,
  sanitizeName,
  sanitizePhone,
  sanitizePincode,
} from "../sanitize";
import { companyDetailSchema, type CompanyDetailFormValues } from "../schema";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  fileToDataUri,
  validateImageFile,
} from "../utils";

const EMPTY: CompanyDetailFormValues = {
  name: "",
  phone: "",
  email: "",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
  gstin: "",
  pan: "",
  logoDataUri: "",
};

/** Company sub-tab of Sales Settings — single upsert-only form, Docs
 * design decision #4/#5 (CompanyDetail is a singleton, PUT always upserts). */
export function CompanyDetailForm() {
  const canRead = usePermission(COMPANY_DETAIL_READ);
  const canWrite = usePermission(COMPANY_DETAIL_WRITE);
  const query = useCompanyDetail();
  const upsert = useUpsertCompanyDetail();
  const { toast } = useToast();

  const [values, setValues] = useState<CompanyDetailFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to company details">
        Ask an administrator for the <code>{COMPANY_DETAIL_READ}</code>{" "}
        permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const current: CompanyDetailFormValues =
    values ??
    (query.data
      ? {
          name: query.data.name,
          phone: query.data.phone ?? "",
          email: query.data.email ?? "",
          website: query.data.website ?? "",
          addressLine1: query.data.addressLine1 ?? "",
          addressLine2: query.data.addressLine2 ?? "",
          city: query.data.city ?? "",
          state: query.data.state ?? "",
          pincode: query.data.pincode ?? "",
          country: query.data.country ?? "",
          gstin: query.data.gstin ?? "",
          pan: query.data.pan ?? "",
          logoDataUri: query.data.logoDataUri ?? "",
        }
      : EMPTY);

  function setField<K extends keyof CompanyDetailFormValues>(
    key: K,
    value: CompanyDetailFormValues[K],
  ) {
    setValues({ ...current, [key]: value });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, logoDataUri: validationError }));
      e.target.value = "";
      return;
    }
    setErrors((prev) => ({ ...prev, logoDataUri: "" }));
    const dataUri = await fileToDataUri(file);
    setField("logoDataUri", dataUri);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = companyDetailSchema.safeParse(current);
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
    try {
      const input = Object.fromEntries(
        Object.entries(result.data).filter(([, v]) => v !== ""),
      ) as typeof result.data;
      await upsert.mutateAsync({ ...input, name: result.data.name });
      toast({ title: "Company details saved", variant: "success" });
    } catch (error) {
      if (error instanceof ApiError && error.isPermissionError) {
        setSubmitError(
          `You don't have the ${COMPANY_DETAIL_WRITE} permission.`,
        );
      } else {
        setSubmitError("Could not save company details. Try again.");
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Company name" required error={errors.name}>
            {(fp) => (
              <Input
                {...fp}
                value={current.name}
                onChange={(e) => setField("name", sanitizeName(e.target.value))}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            {(fp) => (
              <Input
                {...fp}
                value={current.phone}
                onChange={(e) =>
                  setField("phone", sanitizePhone(e.target.value))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Email" error={errors.email}>
            {(fp) => (
              <Input
                {...fp}
                type="email"
                value={current.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Website" error={errors.website}>
            {(fp) => (
              <Input
                {...fp}
                value={current.website}
                onChange={(e) => setField("website", e.target.value)}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Address line 1" error={errors.addressLine1}>
            {(fp) => (
              <Input
                {...fp}
                value={current.addressLine1}
                onChange={(e) => setField("addressLine1", e.target.value)}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Address line 2" error={errors.addressLine2}>
            {(fp) => (
              <Input
                {...fp}
                value={current.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="City" error={errors.city}>
            {(fp) => (
              <Input
                {...fp}
                value={current.city}
                onChange={(e) => setField("city", sanitizeName(e.target.value))}
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="State" error={errors.state}>
            {(fp) => (
              <Input
                {...fp}
                value={current.state}
                onChange={(e) =>
                  setField("state", sanitizeName(e.target.value))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Pincode" error={errors.pincode}>
            {(fp) => (
              <Input
                {...fp}
                value={current.pincode}
                onChange={(e) =>
                  setField("pincode", sanitizePincode(e.target.value))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="Country" error={errors.country}>
            {(fp) => (
              <Input
                {...fp}
                value={current.country}
                onChange={(e) =>
                  setField("country", sanitizeName(e.target.value))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="GSTIN" error={errors.gstin}>
            {(fp) => (
              <Input
                {...fp}
                value={current.gstin}
                onChange={(e) =>
                  setField("gstin", sanitizeCode(e.target.value, 15))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
          <FormField label="PAN" error={errors.pan}>
            {(fp) => (
              <Input
                {...fp}
                value={current.pan}
                onChange={(e) =>
                  setField("pan", sanitizeCode(e.target.value, 10))
                }
                disabled={!canWrite || upsert.isPending}
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Logo"
          hint="Shown on printed sales documents. PNG or JPG, up to 5 MB."
          error={errors.logoDataUri}
        >
          {({ invalid: _invalid, ...fp }) => (
            <div className="flex items-center gap-4">
              {current.logoDataUri ? (
                <img
                  src={current.logoDataUri}
                  alt="Company logo"
                  className="h-12 w-12 rounded-lg border border-gray-200 object-contain dark:border-gray-800"
                />
              ) : null}
              <input
                {...fp}
                type="file"
                accept={ACCEPTED_IMAGE_ACCEPT_ATTR}
                onChange={(e) => void handleLogoChange(e)}
                disabled={!canWrite || upsert.isPending}
                className="text-theme-sm text-gray-600 dark:text-gray-300"
              />
            </div>
          )}
        </FormField>

        {submitError ? (
          <p className="text-theme-xs text-error-600 dark:text-error-400">
            {submitError}
          </p>
        ) : null}

        {canWrite ? (
          <div className="flex justify-end">
            <Button type="submit" loading={upsert.isPending}>
              Save company details
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
