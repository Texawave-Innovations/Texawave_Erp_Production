"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { GST_STATES } from "../../shared/gst";
import { COMPANY_LOGO } from "../api";
import {
  useCompanyProfile,
  useRemoveCompanyLogo,
  useSaveCompanyProfile,
  useUploadCompanyLogo,
} from "../hooks";
import {
  companySchema,
  companyToBody,
  companyToForm,
  type CompanyValues,
} from "../schema";
import type { CompanyProfile } from "../types";
import { AuthImage } from "./AuthImage";
import { ImageUploadButton } from "./ImageUploadButton";

function CompanyForm({
  profile,
  canWrite,
}: {
  profile: CompanyProfile | null;
  canWrite: boolean;
}) {
  const { toast } = useToast();
  const save = useSaveCompanyProfile();
  const [values, setValues] = useState<CompanyValues>(() =>
    companyToForm(profile),
  );
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, changed, validateAll, setServerErrors } =
    useFormValidation(companySchema, values);
  const locked = !canWrite || save.isPending;
  const gstState = /^[0-9]{2}/.test(values.gstin)
    ? values.gstin.slice(0, 2)
    : null;

  function set<K extends keyof CompanyValues>(k: K, v: CompanyValues[K]) {
    changed(String(k));
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) {
      setError("Fix the highlighted fields and try again.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(companyToBody(values));
      toast({ title: "Company details saved", variant: "success" });
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "INVALID_STATE_CODE") {
        setServerErrors({ stateCode: err.message });
      }
      if (err instanceof ApiError && err.errorCode === "PAN_GSTIN_MISMATCH") {
        setServerErrors({ pan: err.message });
      }
      setError(
        err instanceof ApiError
          ? err.fieldErrors.length
            ? `The server rejected some values: ${err.fieldErrors.join("; ")}`
            : err.message
          : "Could not save.",
      );
    }
  }

  const text = (
    k: "legalName" | "tagline" | "pan" | "email" | "phone",
    label: string,
    opts: { required?: boolean; max: number; upper?: boolean; type?: string },
  ) => (
    <FormField
      label={label}
      required={opts.required ?? false}
      errorVariant="bubble"
      error={errorFor(k)}
    >
      {(f) => (
        <Input
          {...f}
          type={opts.type ?? "text"}
          maxLength={opts.max}
          value={values[k]}
          disabled={locked}
          onBlur={() => touch(k)}
          onChange={(e) =>
            set(k, opts.upper ? e.target.value.toUpperCase() : e.target.value)
          }
        />
      )}
    </FormField>
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Company details"
      className="flex flex-col gap-4"
    >
      {error ? (
        <Alert variant="error" title="The company details were not saved">
          {error}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {text("legalName", "Legal name", { required: true, max: 200 })}
        {text("tagline", "Tagline", { max: 200 })}
      </div>
      <FormField
        label="Address"
        required
        errorVariant="bubble"
        error={errorFor("address")}
      >
        {(f) => (
          <Textarea
            {...f}
            rows={3}
            maxLength={1000}
            value={values.address}
            disabled={locked}
            onBlur={() => touch("address")}
            onChange={(e) => set("address", e.target.value)}
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField
          label="GSTIN"
          errorVariant="bubble"
          error={errorFor("gstin")}
        >
          {(f) => (
            <Input
              {...f}
              maxLength={15}
              value={values.gstin}
              disabled={locked}
              onBlur={() => touch("gstin")}
              onChange={(e) => {
                changed("pan");
                changed("stateCode");
                set("gstin", e.target.value.toUpperCase());
              }}
            />
          )}
        </FormField>
        <FormField
          label="GST state"
          required={!gstState}
          errorVariant="bubble"
          error={errorFor("stateCode")}
          hint={gstState ? "Taken from the GSTIN." : undefined}
        >
          {(f) => (
            <Select
              {...f}
              value={gstState ?? values.stateCode}
              disabled={locked || gstState !== null}
              onBlur={() => touch("stateCode")}
              onChange={(e) => set("stateCode", e.target.value)}
            >
              <option value="">Select a state</option>
              {GST_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {text("pan", "PAN", { max: 10, upper: true })}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {text("email", "Email", { max: 254, type: "email" })}
        {text("phone", "Phone", { max: 30, type: "tel" })}
      </div>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            Save company details
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/** The seller block printed on every Sales document, and its logo. */
export function CompanyTab() {
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.masterWrite);
  const query = useCompanyProfile();
  const upload = useUploadCompanyLogo();
  const remove = useRemoveCompanyLogo();

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const profile = query.data;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <Card className="flex flex-col gap-4 xl:col-span-2">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          Company details
        </h2>
        {!profile ? (
          <Alert variant="warning" title="Not set up yet">
            Documents cannot be printed until the company details are saved.
          </Alert>
        ) : null}
        <CompanyForm profile={profile} canWrite={canWrite} />
      </Card>
      <Card className="flex flex-col gap-4 xl:self-start">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          Logo
        </h2>
        {profile?.hasLogo ? (
          <AuthImage
            path={COMPANY_LOGO}
            version={JSON.stringify(profile)}
            alt="Company logo"
            className="h-24 w-auto max-w-full object-contain"
          />
        ) : (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            No logo uploaded.
          </p>
        )}
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <ImageUploadButton
              label={profile?.hasLogo ? "Replace logo" : "Upload logo"}
              ariaLabel="Logo file"
              disabled={!profile}
              onUpload={(file) => upload.mutateAsync(file)}
            />
            {profile?.hasLogo ? (
              <Button
                variant="ghost"
                size="sm"
                loading={remove.isPending}
                onClick={async () => {
                  try {
                    await remove.mutateAsync();
                    toast({ title: "Logo removed", variant: "success" });
                  } catch (e) {
                    toast({
                      title:
                        e instanceof ApiError ? e.message : "Could not remove",
                      variant: "error",
                    });
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          PNG or JPG, up to 2 MB.{" "}
          {!profile ? "Save the company details first." : null}
        </p>
      </Card>
    </div>
  );
}
