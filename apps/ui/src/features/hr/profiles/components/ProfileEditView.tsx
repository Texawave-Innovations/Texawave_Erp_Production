"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useProfile,
  useSensitive,
  useUpdateProfile,
  useUpdateSensitive,
} from "../hooks";
import {
  PROFILE_WRITE_TEAM_OR_ALL,
  SENSITIVE_READ,
  SENSITIVE_WRITE,
} from "../permissions";
import {
  buildProfilePatch,
  buildSensitivePatch,
  formFromProfile,
  formFromSensitive,
  isProfileDirty,
  validateProfileForm,
  validateSensitiveForm,
  type AddressForm,
  type FormErrors,
  type ProfileFormValues,
  type SensitiveFormValues,
} from "../schema";

/** Turns a failed save into one message the user can act on. */
export function describeSaveError(error: unknown): {
  message: string;
  details: string[];
} {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return {
        message: "You don't have permission to save this profile.",
        details: [],
      };
    }
    if (error.isNotFound) {
      return {
        message:
          "This employee no longer exists, or is outside your access. Go back and check the employee.",
        details: [],
      };
    }
    if (error.isValidationError) {
      return {
        message: "The server rejected some values. Fix them and try again.",
        details: error.fieldErrors,
      };
    }
    return { message: error.message, details: [] };
  }
  return { message: "Could not save this profile. Try again.", details: [] };
}

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to edit profiles">
      Ask an administrator for the <code>hr.employee_profile.write</code>{" "}
      permission.
    </Alert>
  );
}

function SaveErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const { message, details } = describeSaveError(error);
  return (
    <Alert variant="error" title="Could not save">
      <p>{message}</p>
      {details.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

export function ProfileEditView({ id }: { id: number }) {
  const canWrite = usePermission(PROFILE_WRITE_TEAM_OR_ALL);
  const query = useProfile(id);

  if (!canWrite) return <NoWriteAccess />;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card>
          <EmptyState
            title="Profile not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="text-brand-600 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </Card>
      );
    }
    return (
      <ErrorState
        title="Could not load this profile"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <EditBody
      id={id}
      employeeName={query.data.employee.fullName}
      initial={formFromProfile(query.data)}
    />
  );
}

function EditBody({
  id,
  employeeName,
  initial,
}: {
  id: number;
  employeeName: string;
  initial: ProfileFormValues;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const updateMutation = useUpdateProfile();
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const dirty = isProfileDirty(initial, values);

  const set = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const setAddress = (
    key: "presentAddress" | "permanentAddress",
    field: keyof AddressForm,
    value: string,
  ) => {
    setValues((v) => ({ ...v, [key]: { ...v[key], [field]: value } }));
    setErrors((e) => {
      const k = `${key}.${field}`;
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);

    const found = validateProfileForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = buildProfilePatch(initial, values);
    if (Object.keys(body).length === 0) {
      toast({ title: "No changes to save", variant: "info" });
      return;
    }

    try {
      await updateMutation.mutateAsync({ id, body });
      toast({ title: "Profile saved", variant: "success" });
      router.push(`/hr/employees/${id}/profile`);
    } catch (error) {
      setSaveError(error);
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    router.push(`/hr/employees/${id}/profile`);
  }

  const saving = updateMutation.isPending;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <form
        onSubmit={handleSave}
        noValidate
        className="flex min-w-0 flex-col gap-4"
      >
        <Link
          href={`/hr/employees/${id}/profile`}
          className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          ← Back to profile
        </Link>
        <div>
          <h1 className="break-words text-theme-xl font-semibold text-gray-900 dark:text-white/90">
            Edit profile
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {employeeName}
          </p>
        </div>

        <SaveErrorAlert error={saveError} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Personal information
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Title"
                value={values.title}
                error={errors.title}
                onChange={(v) => set("title", v)}
                placeholder="Mr, Ms, Dr"
              />
              <TextField
                label="Date of birth"
                type="date"
                value={values.dateOfBirth}
                error={errors.dateOfBirth}
                onChange={(v) => set("dateOfBirth", v)}
              />
              <TextField
                label="Gender"
                value={values.gender}
                error={errors.gender}
                onChange={(v) => set("gender", v)}
              />
              <TextField
                label="Marital status"
                value={values.maritalStatus}
                error={errors.maritalStatus}
                onChange={(v) => set("maritalStatus", v)}
              />
              <TextField
                label="Blood group"
                value={values.bloodGroup}
                error={errors.bloodGroup}
                onChange={(v) => set("bloodGroup", v)}
                placeholder="O+"
              />
              <TextField
                label="Languages"
                value={values.languages}
                error={errors.languages}
                onChange={(v) => set("languages", v)}
                placeholder="English, Hindi"
                hint="Separate with commas. Up to 10."
              />
            </div>
          </Card>

          <Card className="min-w-0">
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Family details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Father's name"
                value={values.fatherName}
                error={errors.fatherName}
                onChange={(v) => set("fatherName", v)}
              />
              <TextField
                label="Mother's name"
                value={values.motherName}
                error={errors.motherName}
                onChange={(v) => set("motherName", v)}
              />
              <TextField
                label="Spouse name"
                value={values.spouseName}
                error={errors.spouseName}
                onChange={(v) => set("spouseName", v)}
              />
            </div>
          </Card>

          <Card className="min-w-0">
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Emergency contact
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Name"
                value={values.emergencyName}
                error={errors.emergencyName}
                onChange={(v) => set("emergencyName", v)}
              />
              <TextField
                label="Phone"
                value={values.emergencyPhone}
                error={errors.emergencyPhone}
                onChange={(v) => set("emergencyPhone", v)}
                placeholder="+91 98765 43210"
              />
              <TextField
                label="Relation"
                value={values.emergencyRelation}
                error={errors.emergencyRelation}
                onChange={(v) => set("emergencyRelation", v)}
                placeholder="Father, Spouse"
              />
            </div>
          </Card>

          <Card className="min-w-0">
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Experience
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
                <Checkbox
                  checked={values.isFresher}
                  onChange={(e) => set("isFresher", e.target.checked)}
                />
                Fresher (no prior experience)
              </label>
              <TextField
                label="Total experience (years)"
                value={values.experienceYears}
                error={errors.experienceYears}
                onChange={(v) => set("experienceYears", v)}
                inputMode="decimal"
                placeholder="4.5"
              />
              <TextField
                label="Previous company"
                value={values.previousCompany}
                error={errors.previousCompany}
                onChange={(v) => set("previousCompany", v)}
              />
              <TextField
                label="Previous role"
                value={values.previousRole}
                error={errors.previousRole}
                onChange={(v) => set("previousRole", v)}
              />
            </div>
          </Card>

          <div className="xl:col-span-2">
            <Card className="min-w-0">
              <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Addresses
              </h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AddressFields
                  legend="Current address"
                  prefix="presentAddress"
                  value={values.presentAddress}
                  errors={errors}
                  onChange={(f, v) => setAddress("presentAddress", f, v)}
                />
                <AddressFields
                  legend="Permanent address"
                  prefix="permanentAddress"
                  value={values.permanentAddress}
                  errors={errors}
                  onChange={(f, v) => setAddress("permanentAddress", f, v)}
                />
              </div>
            </Card>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-white/95 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-dark/95">
          {dirty ? (
            <span className="mr-auto text-theme-xs text-gray-500 dark:text-gray-400">
              Unsaved changes
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={saving || !dirty}>
            Save profile
          </Button>
        </div>
      </form>

      <StatutoryEditSection id={id} />
    </div>
  );
}

function TextField({
  label,
  value,
  error,
  onChange,
  type = "text",
  placeholder,
  hint,
  inputMode,
}: {
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string | undefined;
  hint?: string | undefined;
  inputMode?: "decimal" | "text" | undefined;
}) {
  return (
    <FormField label={label} error={error} hint={hint}>
      {(f) => (
        <Input
          {...f}
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          invalid={f.invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}

function AddressFields({
  legend,
  prefix,
  value,
  errors,
  onChange,
}: {
  legend: string;
  prefix: "presentAddress" | "permanentAddress";
  value: AddressForm;
  errors: FormErrors;
  onChange: (field: keyof AddressForm, v: string) => void;
}) {
  const err = (f: keyof AddressForm) => errors[`${prefix}.${f}`];
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="mb-2 text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {legend}
      </legend>
      <div className="sm:col-span-2">
        <FormField label="Address" error={err("address")}>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              value={value.address}
              invalid={f.invalid}
              onChange={(e) => onChange("address", e.target.value)}
            />
          )}
        </FormField>
      </div>
      <TextField
        label="Area"
        value={value.area}
        error={err("area")}
        onChange={(v) => onChange("area", v)}
      />
      <TextField
        label="District"
        value={value.district}
        error={err("district")}
        onChange={(v) => onChange("district", v)}
      />
      <TextField
        label="City"
        value={value.city}
        error={err("city")}
        onChange={(v) => onChange("city", v)}
      />
      <TextField
        label="State"
        value={value.state}
        error={err("state")}
        onChange={(v) => onChange("state", v)}
      />
      <TextField
        label="Pincode"
        value={value.pincode}
        error={err("pincode")}
        onChange={(v) => onChange("pincode", v)}
      />
      <TextField
        label="Country"
        value={value.country}
        error={err("country")}
        onChange={(v) => onChange("country", v)}
      />
    </fieldset>
  );
}

/**
 * Statutory and bank details. Shown only to holders of both the sensitive read
 * and write permissions, so the form always starts from the stored values.
 */
function StatutoryEditSection({ id }: { id: number }) {
  const canRead = usePermission(SENSITIVE_READ);
  const canWrite = usePermission(SENSITIVE_WRITE);
  if (!canRead || !canWrite) return null;
  return <StatutoryEditForm id={id} />;
}

function StatutoryEditForm({ id }: { id: number }) {
  const { toast } = useToast();
  const query = useSensitive(id, true);
  const updateMutation = useUpdateSensitive();
  const [values, setValues] = useState<SensitiveFormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  if (query.isPending) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load statutory and bank details"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const initial = formFromSensitive(query.data);
  const current = values ?? initial;
  const dirty = Object.keys(buildSensitivePatch(initial, current)).length > 0;
  const saving = updateMutation.isPending;

  const set = (key: keyof SensitiveFormValues, value: string) => {
    setValues({ ...current, [key]: value });
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const found = validateSensitiveForm(current);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = buildSensitivePatch(initial, current);
    if (Object.keys(body).length === 0) {
      toast({ title: "No changes to save", variant: "info" });
      return;
    }
    try {
      await updateMutation.mutateAsync({ id, body });
      setValues(null);
      toast({ title: "Statutory and bank details saved", variant: "success" });
    } catch (error) {
      setSaveError(error);
    }
  }

  const fields: Array<[keyof SensitiveFormValues, string, string?]> = [
    ["panNumber", "PAN", "ABCDE1234F"],
    ["aadhaarNumber", "Aadhaar", "12 digits"],
    ["esiNumber", "ESI number", "10 to 17 digits"],
    ["pfNumber", "PF number", ""],
    ["bankName", "Bank name", ""],
    ["bankBranch", "Branch", ""],
    ["bankAccountNo", "Account number", "6 to 20 digits"],
    ["bankIfsc", "IFSC", "SBIN0001234"],
  ];

  return (
    <Card className="min-w-0">
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
        <div>
          <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Statutory and bank
          </h2>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            Changes are recorded in the audit log by field name. Leave a field
            blank and save to clear it.
          </p>
        </div>
        <SaveErrorAlert error={saveError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <TextField
              key={key}
              label={label}
              value={current[key]}
              error={errors[key]}
              placeholder={placeholder}
              onChange={(v) => set(key, v)}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={saving || !dirty}>
            Save statutory and bank
          </Button>
        </div>
      </form>
    </Card>
  );
}
