"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Semantic3DIcon,
  type Icon3DName,
  Skeleton,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useUploadEmployeeDocument } from "@/features/hr/employee-documents/hooks";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  type CodeOption,
} from "../codes";
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

function EditCardSection({
  title,
  description,
  icon3d,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon3d: Icon3DName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] dark:border-slate-700/80 dark:bg-gray-900 ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
          <Semantic3DIcon name={icon3d} size={28} />
        </div>
        <div>
          <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-6">
        <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ProfileEditView({ id }: { id: number }) {
  const canWrite = usePermission(PROFILE_WRITE_TEAM_OR_ALL);
  const query = useProfile(id);

  if (!canWrite) return <NoWriteAccess />;

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12 animate-pulse">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <div className="mx-auto max-w-5xl rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
          <EmptyState
            title="Profile not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="font-bold text-brand-500 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <ErrorState
        title="Could not load profile"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <ProfileEditForm
      id={id}
      initial={formFromProfile(query.data)}
      employeeName={query.data.employee.fullName}
      employeeCode={query.data.employee.employeeCode}
      initialAvatarUrl={query.data.employee.avatarUrl}
    />
  );
}

function ProfileEditForm({
  id,
  initial,
  employeeName,
  employeeCode,
  initialAvatarUrl,
}: {
  id: number;
  initial: ProfileFormValues;
  employeeName: string;
  employeeCode: string;
  initialAvatarUrl?: string | null | undefined;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateProfile();
  const uploadMutation = useUploadEmployeeDocument(id);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null,
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file format",
        description: "Please select an image file (PNG, JPG, JPEG, or WebP).",
        variant: "warning",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Photo file size must not exceed 5MB.",
        variant: "warning",
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const res = await uploadMutation.mutateAsync({
        label: "Profile Photo",
        file,
        documentType: "PROFILE_PHOTO",
      });
      const newAvatarUrl = `/hr/employees/${id}/documents/${res.id}/file`;
      setCurrentAvatarUrl(newAvatarUrl);
      await queryClient.invalidateQueries({ queryKey: ["hr-profiles", id] });
      toast({
        title: "Profile photo updated",
        description: "Employee profile photo has been uploaded and updated successfully.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload the profile photo. Please try again.",
        variant: "error",
      });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const dirty = isProfileDirty(initial, values);

  const set = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
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
    <div className="mx-auto max-w-5xl space-y-6 pb-12 animate-reveal">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href={`/hr/employees/${id}/profile`}
              className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to profile</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title-sm font-bold tracking-tight text-[#0a3271] dark:text-white">
                Edit Profile: {employeeName}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/80 px-3 py-0.5 text-[11px] font-bold text-brand-500 shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                {employeeCode}
              </span>
            </div>

            <p className="max-w-2xl text-[12px] font-medium text-[#2f6396] dark:text-sky-300/80">
              Update personal identity, family members, emergency contact, experience, and residential addresses.
            </p>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-2 shadow-[0_8px_20px_rgba(23,105,245,0.12)] ring-4 ring-white/70 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-800/60">
              <Semantic3DIcon name="edit" size={42} alt="Edit employee profile" />
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        noValidate
        className="flex min-w-0 flex-col gap-6"
      >
        <SaveErrorAlert error={saveError} />

        {/* Profile Photo Section */}
        <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900">
          <div className="flex items-center gap-3 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Camera className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                Employee Profile Photo
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                Official employee photo. Reflected across HR profiles, employee documents, and system records.
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <EmployeeIdentity
                  name={employeeName}
                  code={employeeCode}
                  avatarUrl={currentAvatarUrl}
                  size="lg"
                />
                <div>
                  <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
                    {employeeName}
                  </h3>
                  <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    {currentAvatarUrl ? "Custom profile photo is active" : "Default initials avatar"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    PNG, JPG, or WebP up to 5MB.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="rounded-xl border border-sky-200/90 bg-white px-4 py-2 text-xs font-bold text-[#0a3271] shadow-2xs hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-brand-500" />
                  ) : (
                    <Camera className="h-4 w-4 mr-1.5 text-brand-500" />
                  )}
                  {isUploadingPhoto ? "Uploading..." : currentAvatarUrl ? "Change Photo" : "Upload Photo"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Personal Information */}
          <EditCardSection
            title="Personal Information"
            icon3d="user"
            description="Demographics, blood group, and languages"
          >
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
              <CodeSelectField
                label="Gender"
                value={values.gender}
                error={errors.gender}
                options={GENDER_OPTIONS}
                onChange={(v) => set("gender", v)}
              />
              <CodeSelectField
                label="Marital status"
                value={values.maritalStatus}
                error={errors.maritalStatus}
                options={MARITAL_OPTIONS}
                onChange={(v) => set("maritalStatus", v)}
              />
              <CodeSelectField
                label="Blood group"
                value={values.bloodGroup}
                error={errors.bloodGroup}
                options={BLOOD_GROUP_OPTIONS}
                onChange={(v) => set("bloodGroup", v)}
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
          </EditCardSection>

          {/* Family Details */}
          <EditCardSection
            title="Family Details"
            icon3d="people"
            description="Parental and marital records"
          >
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
              <div className="sm:col-span-2">
                <TextField
                  label="Spouse name"
                  value={values.spouseName}
                  error={errors.spouseName}
                  onChange={(v) => set("spouseName", v)}
                />
              </div>
            </div>
          </EditCardSection>

          {/* Emergency Contact */}
          <EditCardSection
            title="Emergency Contact"
            icon3d="bell"
            description="Primary emergency contact details"
          >
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
              <div className="sm:col-span-2">
                <TextField
                  label="Relation"
                  value={values.emergencyRelation}
                  error={errors.emergencyRelation}
                  onChange={(v) => set("emergencyRelation", v)}
                  placeholder="Father, Spouse, Friend"
                />
              </div>
            </div>
          </EditCardSection>

          {/* Experience */}
          <EditCardSection
            title="Prior Work Experience"
            icon3d="recruitment"
            description="Domain history and experience duration"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-theme-sm font-semibold text-[#0a3271] dark:text-sky-200 sm:col-span-2">
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
              <div className="sm:col-span-2">
                <TextField
                  label="Previous role"
                  value={values.previousRole}
                  error={errors.previousRole}
                  onChange={(v) => set("previousRole", v)}
                />
              </div>
            </div>
          </EditCardSection>

          {/* Addresses */}
          <div className="xl:col-span-2">
            <EditCardSection
              title="Residential Addresses"
              icon3d="departments"
              description="Current and permanent residence addresses"
            >
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
            </EditCardSection>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200/90 bg-white p-4.5 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700 dark:bg-gray-900">
          {dirty ? (
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              ● Unsaved changes
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving || !dirty}
            >
              Save profile
            </Button>
          </div>
        </div>
      </form>

      <StatutoryEditSection id={id} />
    </div>
  );
}

/** A code field; a stored value outside the list (legacy free text) stays
 * selectable so opening the form never silently changes it. */
function CodeSelectField({
  label,
  value,
  error,
  options,
  onChange,
}: {
  label: string;
  value: string;
  error?: string | undefined;
  options: readonly CodeOption[];
  onChange: (v: string) => void;
}) {
  const known = value === "" || options.some((o) => o.value === value);
  return (
    <FormField label={label} error={error}>
      {(f) => (
        <Select {...f} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not specified</option>
          {!known ? <option value={value}>{value}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </FormField>
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
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
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
    return <Skeleton className="h-40 w-full rounded-2xl" />;
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
    <EditCardSection
      title="Statutory & Bank Details"
      icon3d="access-control"
      description="Changes are recorded in the security audit log. Leave blank and save to clear."
    >
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
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
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={saving || !dirty}
          >
            Save statutory and bank
          </Button>
        </div>
      </form>
    </EditCardSection>
  );
}
