"use client";

import {
  ApiError,
  addressSchema,
  mobile,
  personalDetailsSchema,
  requiredName,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  Contact,
  Edit3,
  GraduationCap,
  Info,
  Landmark,
  Lock,
  MapPin,
  Phone,
  Save,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type {
  SelfProfileAddress,
  SelfProfileUpdate,
} from "@/features/onboarding/api";
import {
  useMyAddress,
  useMyBank,
  useMyEmployee,
  useMyExperience,
  useMyFamilyMembers,
  useMyGovernmentIds,
  useMyPersonal,
  useUpdateMyProfile,
} from "@/features/onboarding/hooks";

type Data = Record<string, unknown> | null | undefined;

function str(data: Data, key: string): string | null {
  const v = data?.[key];
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return v.slice(0, 10);
  }
  return String(v);
}

function title(v: string | null | undefined): string | null {
  if (!v) return null;
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function maskTail(v: string | null): string | null {
  if (!v) return null;
  return v.length <= 4 ? v : `${"*".repeat(v.length - 4)}${v.slice(-4)}`;
}

function addressLine(data: Data): string | null {
  const parts = [
    str(data, "addressLine"),
    str(data, "areaLocality"),
    str(data, "city"),
    str(data, "district"),
    str(data, "state"),
    str(data, "pincode"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// ---------------------------------------------------------------------------
// Edit form state — only the self-editable subset (PATCH /employee/profile).
// ---------------------------------------------------------------------------

const PERSONAL_KEYS = [
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "bloodGroup",
  "emergencyContactName",
  "emergencyContactRelation",
  "emergencyContactPhone",
  "fatherName",
  "fatherPhone",
  "motherName",
  "motherPhone",
] as const;
type PersonalKey = (typeof PERSONAL_KEYS)[number];

const ADDRESS_KEYS = [
  "addressLine",
  "areaLocality",
  "district",
  "city",
  "state",
  "pincode",
] as const;
type AddressKey = (typeof ADDRESS_KEYS)[number];
type AddressForm = Record<AddressKey, string>;

interface ProfileForm {
  fullName: string;
  phone: string;
  referredBy: string;
  personal: Record<PersonalKey, string>;
  permanent: AddressForm;
  sameAsPermanent: boolean;
  present: AddressForm;
}

type Errors = Record<string, string>;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
/** Selects that may be left empty (sent as null); every other personal field
 * is required once onboarding is done (the API refuses to blank it). */
const NULLABLE_PERSONAL = new Set<PersonalKey>(["maritalStatus", "bloodGroup"]);
const NAME_KEYS = new Set<string>([
  "fullName",
  "emergencyContactName",
  "emergencyContactRelation",
  "fatherName",
  "motherName",
  "areaLocality",
  "district",
  "city",
]);
const PHONE_KEYS = new Set<string>([
  "phone",
  "emergencyContactPhone",
  "fatherPhone",
  "motherPhone",
]);
const TODAY = new Date().toISOString().slice(0, 10);

/** Same keystroke filtering as the onboarding wizard (OnboardingWizard.tsx). */
function sanitize(key: string, raw: string): string {
  if (NAME_KEYS.has(key)) return raw.replace(/[^A-Za-z .'-]/g, "");
  if (PHONE_KEYS.has(key)) return raw.replace(/\D/g, "").slice(0, 10);
  if (key === "pincode") return raw.replace(/\D/g, "").slice(0, 6);
  return raw;
}

function toAddressForm(data: Data): AddressForm {
  return Object.fromEntries(
    ADDRESS_KEYS.map((k) => [k, str(data, k) ?? ""]),
  ) as AddressForm;
}

function sameAddress(a: AddressForm, b: AddressForm): boolean {
  return ADDRESS_KEYS.every((k) => a[k] === b[k]);
}

function parseAddress(
  value: AddressForm,
  prefix: string,
  errors: Errors,
): SelfProfileAddress | undefined {
  const parsed = addressSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = `${prefix}.${String(issue.path[0])}`;
      if (!(key in errors)) errors[key] = issue.message;
    }
    return undefined;
  }
  const { areaLocality, ...rest } = parsed.data;
  return areaLocality ? { ...rest, areaLocality } : rest;
}

/** Diffs the form against what was loaded and returns only the changed
 * fields, validated with the same zod rules the onboarding wizard uses. */
function buildPatch(
  initial: ProfileForm,
  form: ProfileForm,
): { patch: SelfProfileUpdate; errors: Errors } {
  const patch: SelfProfileUpdate = {};
  const errors: Errors = {};

  if (form.fullName !== initial.fullName) {
    // Same rule as the API: letters, spaces and . ' - only, 1–200 characters.
    const parsed = requiredName(200).safeParse(form.fullName);
    if (parsed.success) patch.fullName = parsed.data;
    else
      errors.fullName =
        parsed.error.issues[0]?.message ?? "Enter a valid name.";
  }
  if (form.phone !== initial.phone) {
    const parsed = mobile.safeParse(form.phone);
    if (parsed.success) patch.phone = parsed.data;
    else errors.phone = parsed.error.issues[0]?.message ?? "Invalid phone.";
  }
  if (form.referredBy !== initial.referredBy) {
    const value = form.referredBy.trim();
    if (value.length > 100)
      errors.referredBy = "Must be at most 100 characters.";
    else patch.referredBy = value || null;
  }

  for (const key of PERSONAL_KEYS) {
    const value = form.personal[key];
    if (value === initial.personal[key]) continue;
    if (NULLABLE_PERSONAL.has(key)) {
      (patch as Record<string, unknown>)[key] = value || null;
      continue;
    }
    const parsed = personalDetailsSchema.shape[key].safeParse(value);
    if (parsed.success) (patch as Record<string, unknown>)[key] = parsed.data;
    else
      errors[`personal.${key}`] =
        parsed.error.issues[0]?.message ?? "This field is required.";
  }

  if (!sameAddress(form.permanent, initial.permanent)) {
    const address = parseAddress(form.permanent, "permanent", errors);
    if (address) patch.permanentAddress = address;
  }
  if (form.sameAsPermanent) {
    if (!initial.sameAsPermanent) patch.presentAddress = null;
  } else if (
    initial.sameAsPermanent ||
    !sameAddress(form.present, initial.present)
  ) {
    const address = parseAddress(form.present, "present", errors);
    if (address) patch.presentAddress = address;
  }

  return { patch, errors };
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

/** Legacy MyProfile.tsx `InfoRow`: label left, value right, "—" if empty. */
function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-gray-900 dark:text-white">
        {value || "—"}
      </span>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  heading,
  pending = false,
  locked = false,
  children,
}: {
  icon: LucideIcon;
  heading: string;
  pending?: boolean;
  /** HR-managed section: shown read-only with a "Managed by HR" tag. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-fit p-0">
      <h2 className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
        <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
        {heading}
        {locked ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Managed by HR
          </span>
        ) : null}
      </h2>
      <div className="divide-y divide-gray-100 px-5 py-2 dark:divide-gray-800">
        {pending ? <Skeleton className="my-2 h-24 w-full" /> : children}
      </div>
    </Card>
  );
}

/** Edit-mode body of a card: a two-column grid of fields. */
function EditGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 py-3 sm:grid-cols-2">{children}</div>
  );
}

/**
 * "My Profile", laid out like the legacy page (TexaWave_ERP_old
 * src/modules/employee/MyProfile.tsx): a header card (avatar initials, name,
 * designation · department, status, Edit Profile), then a two-column grid —
 * Personal Information and Contact Details on the left, Employment Details
 * and Bank Details on the right. Addresses, government IDs, family and
 * experience (collected by this ERP's onboarding wizard) follow below.
 *
 * Like legacy, the employee can edit their own name, personal and contact
 * details (also after onboarding) — PATCH /employee/profile, audited
 * server-side. Legacy's employee edit also exposed e-mail, department,
 * designation, joining date and office location; here those (plus bank,
 * government IDs, family, experience) stay with HR and keep the "Raise a
 * ticket" path.
 */
export function MyProfileView() {
  const employee = useMyEmployee();
  const personal = useMyPersonal();
  const permanentAddress = useMyAddress("PERMANENT");
  const presentAddress = useMyAddress("PRESENT");
  const bank = useMyBank();
  const governmentIds = useMyGovernmentIds();
  const family = useMyFamilyMembers();
  const experience = useMyExperience();
  const update = useUpdateMyProfile();
  const { toast } = useToast();

  const [initial, setInitial] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const editing = form !== null && initial !== null;

  const emp = employee.data;
  const p = personal.data;
  const name = emp?.fullName ?? "";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "E";
  const subtitle = [emp?.designation?.name ?? "Employee", emp?.department?.name]
    .filter(Boolean)
    .join(" · ");
  const status = (emp?.status ?? "ACTIVE").toLowerCase();
  const emergency = [
    str(p, "emergencyContactName"),
    str(p, "emergencyContactRelation")
      ? `(${str(p, "emergencyContactRelation")})`
      : null,
    str(p, "emergencyContactPhone"),
  ]
    .filter(Boolean)
    .join(" · ");

  const loaded =
    employee.isSuccess &&
    personal.isSuccess &&
    permanentAddress.isSuccess &&
    presentAddress.isSuccess;

  function startEditing() {
    const snapshot: ProfileForm = {
      fullName: emp?.fullName ?? "",
      phone: emp?.phone ?? "",
      referredBy: emp?.referredBy ?? "",
      personal: Object.fromEntries(
        PERSONAL_KEYS.map((k) => [k, str(p, k) ?? ""]),
      ) as Record<PersonalKey, string>,
      permanent: toAddressForm(permanentAddress.data),
      sameAsPermanent: !presentAddress.data,
      present: toAddressForm(presentAddress.data),
    };
    setInitial(snapshot);
    setForm(snapshot);
    setErrors({});
    setSaveError(null);
  }

  function cancelEditing() {
    setInitial(null);
    setForm(null);
    setErrors({});
    setSaveError(null);
  }

  async function save() {
    if (!form || !initial) return;
    setSaveError(null);
    const { patch, errors: found } = buildPatch(initial, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSaveError("Fix the highlighted fields and try again.");
      return;
    }
    if (Object.keys(patch).length === 0) {
      cancelEditing();
      return;
    }
    try {
      await update.mutateAsync(patch);
      toast({ title: "Profile updated successfully.", variant: "success" });
      cancelEditing();
    } catch (error) {
      setSaveError(
        error instanceof ApiError
          ? error.message
          : "Could not save. Check your connection and try again.",
      );
    }
  }

  const busy = update.isPending;
  const setTop = (key: "fullName" | "phone" | "referredBy", value: string) =>
    setForm((f) => (f ? { ...f, [key]: sanitize(key, value) } : f));
  const setPersonalField = (key: PersonalKey, value: string) =>
    setForm((f) =>
      f
        ? { ...f, personal: { ...f.personal, [key]: sanitize(key, value) } }
        : f,
    );
  const setAddressField = (
    which: "permanent" | "present",
    key: AddressKey,
    value: string,
  ) =>
    setForm((f) =>
      f ? { ...f, [which]: { ...f[which], [key]: sanitize(key, value) } } : f,
    );

  const textField = (
    label: string,
    errorKey: string,
    value: string,
    onChange: (v: string) => void,
    opts: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      wide?: boolean;
      inputMode?: "numeric" | "text";
    } = {},
  ) => (
    <div className={opts.wide ? "sm:col-span-2" : undefined}>
      <FormField
        label={label}
        required={opts.required ?? true}
        error={errors[errorKey]}
      >
        {(f) => (
          <Input
            {...f}
            type={opts.type ?? "text"}
            value={value}
            disabled={busy}
            placeholder={opts.placeholder}
            inputMode={opts.inputMode}
            {...(opts.type === "date" ? { min: "1900-01-01", max: TODAY } : {})}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </FormField>
    </div>
  );

  const selectField = (
    label: string,
    key: PersonalKey,
    options: { value: string; label: string }[],
    required: boolean,
  ) =>
    form ? (
      <FormField
        label={label}
        required={required}
        error={errors[`personal.${key}`]}
      >
        {(f) => (
          <Select
            {...f}
            value={form.personal[key]}
            disabled={busy}
            onChange={(e) => setPersonalField(key, e.target.value)}
          >
            <option value="">Select</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    ) : null;

  const addressFields = (which: "permanent" | "present") =>
    form ? (
      <EditGrid>
        {textField(
          "Address line",
          `${which}.addressLine`,
          form[which].addressLine,
          (v) => setAddressField(which, "addressLine", v),
          { wide: true },
        )}
        {textField(
          "Area / locality",
          `${which}.areaLocality`,
          form[which].areaLocality,
          (v) => setAddressField(which, "areaLocality", v),
          { required: false },
        )}
        {textField("District", `${which}.district`, form[which].district, (v) =>
          setAddressField(which, "district", v),
        )}
        {textField("City", `${which}.city`, form[which].city, (v) =>
          setAddressField(which, "city", v),
        )}
        {textField("State", `${which}.state`, form[which].state, (v) =>
          setAddressField(which, "state", v),
        )}
        {textField(
          "Pincode",
          `${which}.pincode`,
          form[which].pincode,
          (v) => setAddressField(which, "pincode", v),
          { inputMode: "numeric" },
        )}
      </EditGrid>
    ) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="sr-only">My Profile</h1>
      {/* Profile header */}
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 shadow-xs dark:border-brand-800 dark:bg-brand-950/40">
              <span className="text-xl font-bold text-brand-600 dark:text-brand-300">
                {initials}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {name}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  status === "active"
                    ? "bg-linear-135 from-brand-600 via-brand-500 to-brand-cyan text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {title(status)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {editing ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={busy}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save()} loading={busy}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Profile
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={startEditing}
                disabled={!loaded}
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Edit Profile
              </Button>
            )}
            <p className="flex max-w-xs items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Work email, employment, bank and ID details are managed by HR.
                Need a change there?{" "}
                <Link
                  href="/portal/tickets"
                  className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Raise a ticket
                </Link>
                .
              </span>
            </p>
          </div>
        </div>
      </Card>

      {saveError ? (
        <Alert variant="error" title="Could not save">
          {saveError}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <InfoCard
            icon={User}
            heading="Personal Information"
            pending={personal.isPending || employee.isPending}
          >
            {editing && form ? (
              <>
                <InfoRow label="Employee ID" value={emp?.employeeCode} />
                <EditGrid>
                  {textField(
                    "Full Name",
                    "fullName",
                    form.fullName,
                    (v) => setTop("fullName", v),
                    { wide: true, placeholder: "Your full name" },
                  )}
                  {selectField(
                    "Gender",
                    "gender",
                    [
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ],
                    true,
                  )}
                  {textField(
                    "Date of Birth",
                    "personal.dateOfBirth",
                    form.personal.dateOfBirth,
                    (v) => setPersonalField("dateOfBirth", v),
                    { type: "date" },
                  )}
                  {selectField(
                    "Blood Group",
                    "bloodGroup",
                    BLOOD_GROUPS.map((b) => ({ value: b, label: b })),
                    false,
                  )}
                  {selectField(
                    "Marital Status",
                    "maritalStatus",
                    [
                      { value: "SINGLE", label: "Single" },
                      { value: "MARRIED", label: "Married" },
                      { value: "OTHER", label: "Other" },
                    ],
                    false,
                  )}
                  {textField(
                    "Referred By",
                    "referredBy",
                    form.referredBy,
                    (v) => setTop("referredBy", v),
                    {
                      required: false,
                      placeholder: "Who referred you?",
                      wide: true,
                    },
                  )}
                </EditGrid>
              </>
            ) : (
              <>
                <InfoRow label="Employee ID" value={emp?.employeeCode} />
                <InfoRow label="Gender" value={title(str(p, "gender"))} />
                <InfoRow label="Date of Birth" value={str(p, "dateOfBirth")} />
                <InfoRow label="Blood Group" value={str(p, "bloodGroup")} />
                <InfoRow
                  label="Marital Status"
                  value={title(str(p, "maritalStatus"))}
                />
                <InfoRow label="Referred By" value={emp?.referredBy} />
              </>
            )}
          </InfoCard>

          <InfoCard
            icon={Phone}
            heading="Contact Details"
            pending={personal.isPending || employee.isPending}
          >
            {editing && form ? (
              <>
                <InfoRow label="Email (managed by HR)" value={emp?.workEmail} />
                <EditGrid>
                  {textField(
                    "Phone",
                    "phone",
                    form.phone,
                    (v) => setTop("phone", v),
                    {
                      wide: true,
                      placeholder: "10-digit number",
                      inputMode: "numeric",
                    },
                  )}
                  {textField(
                    "Emergency contact name",
                    "personal.emergencyContactName",
                    form.personal.emergencyContactName,
                    (v) => setPersonalField("emergencyContactName", v),
                  )}
                  {textField(
                    "Emergency contact relation",
                    "personal.emergencyContactRelation",
                    form.personal.emergencyContactRelation,
                    (v) => setPersonalField("emergencyContactRelation", v),
                  )}
                  {textField(
                    "Emergency contact phone",
                    "personal.emergencyContactPhone",
                    form.personal.emergencyContactPhone,
                    (v) => setPersonalField("emergencyContactPhone", v),
                    { wide: true, inputMode: "numeric" },
                  )}
                  {textField(
                    "Father's name",
                    "personal.fatherName",
                    form.personal.fatherName,
                    (v) => setPersonalField("fatherName", v),
                  )}
                  {textField(
                    "Father's phone",
                    "personal.fatherPhone",
                    form.personal.fatherPhone,
                    (v) => setPersonalField("fatherPhone", v),
                    { inputMode: "numeric" },
                  )}
                  {textField(
                    "Mother's name",
                    "personal.motherName",
                    form.personal.motherName,
                    (v) => setPersonalField("motherName", v),
                  )}
                  {textField(
                    "Mother's phone",
                    "personal.motherPhone",
                    form.personal.motherPhone,
                    (v) => setPersonalField("motherPhone", v),
                    { inputMode: "numeric" },
                  )}
                </EditGrid>
              </>
            ) : (
              <>
                <InfoRow label="Phone" value={emp?.phone} />
                <InfoRow label="Email" value={emp?.workEmail} />
                <InfoRow label="Emergency Contact" value={emergency || null} />
                <InfoRow
                  label="Father"
                  value={
                    [str(p, "fatherName"), str(p, "fatherPhone")]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow
                  label="Mother"
                  value={
                    [str(p, "motherName"), str(p, "motherPhone")]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
              </>
            )}
          </InfoCard>
        </div>

        <div className="space-y-6">
          <InfoCard
            icon={Briefcase}
            heading="Employment Details"
            pending={employee.isPending}
            locked
          >
            <InfoRow label="Department" value={emp?.department?.name} />
            <InfoRow label="Designation" value={emp?.designation?.name} />
            <InfoRow label="Joining Date" value={emp?.dateOfJoining} />
            <InfoRow label="Office Location" value={emp?.workLocation?.name} />
            <InfoRow label="Team" value={emp?.team?.name} />
            <InfoRow label="Reports To" value={emp?.reportsTo?.fullName} />
            <InfoRow
              label="Employment Type"
              value={emp?.employmentType?.name}
            />
            <InfoRow label="Work Domain" value={emp?.workDomain} />
          </InfoCard>

          {bank.data ? (
            <InfoCard icon={Landmark} heading="Bank Details" locked>
              <InfoRow label="Bank Name" value={str(bank.data, "bankName")} />
              <InfoRow
                label="Account No."
                value={str(bank.data, "accountNumberMasked")}
              />
              <InfoRow label="IFSC Code" value={str(bank.data, "ifsc")} />
              <InfoRow label="Branch" value={str(bank.data, "branchName")} />
            </InfoCard>
          ) : null}
        </div>
      </div>

      {editing && form ? (
        <InfoCard icon={MapPin} heading="Addresses">
          <div className="py-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Permanent Address
            </p>
            {addressFields("permanent")}
          </div>
          <div className="py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Checkbox
                checked={form.sameAsPermanent}
                disabled={busy}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, sameAsPermanent: e.target.checked } : f,
                  )
                }
              />
              Present address same as permanent
            </label>
            {!form.sameAsPermanent ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Present Address
                </p>
                {addressFields("present")}
              </div>
            ) : null}
          </div>
        </InfoCard>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {!editing ? (
          <InfoCard
            icon={MapPin}
            heading="Addresses"
            pending={permanentAddress.isPending || presentAddress.isPending}
          >
            <InfoRow
              label="Permanent Address"
              value={addressLine(permanentAddress.data)}
            />
            <InfoRow
              label="Present Address"
              value={
                presentAddress.data
                  ? addressLine(presentAddress.data)
                  : permanentAddress.data
                    ? "Same as permanent"
                    : null
              }
            />
          </InfoCard>
        ) : null}

        <InfoCard
          icon={Contact}
          heading="Government IDs"
          pending={governmentIds.isPending}
          locked
        >
          <InfoRow
            label="Aadhaar"
            value={maskTail(str(governmentIds.data, "aadhaarNumber"))}
          />
          <InfoRow label="PAN" value={str(governmentIds.data, "panNumber")} />
          <InfoRow
            label="PF Number"
            value={str(governmentIds.data, "pfNumber")}
          />
          <InfoRow
            label="ESI Number"
            value={str(governmentIds.data, "esiNumber")}
          />
        </InfoCard>

        <InfoCard
          icon={Users}
          heading="Family"
          pending={family.isPending}
          locked
        >
          {!family.data || family.data.length === 0 ? (
            <p className="py-2.5 text-xs text-gray-400">None added yet.</p>
          ) : (
            family.data.map((member) => (
              <InfoRow
                key={member.id}
                label={member.relation}
                value={[member.name, member.contactPhone]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          )}
        </InfoCard>

        <InfoCard
          icon={GraduationCap}
          heading="Experience"
          pending={experience.isPending}
          locked
        >
          {!experience.data || experience.data.length === 0 ? (
            <p className="py-2.5 text-xs text-gray-400">None added yet.</p>
          ) : (
            experience.data.map((row) => (
              <InfoRow
                key={row.id}
                label={`${row.fromDate} – ${row.toDate ?? "present"}`}
                value={`${row.designation} at ${row.employer}`}
              />
            ))
          )}
        </InfoCard>
      </div>

      {personal.isError || employee.isError ? (
        <p className="flex items-center gap-2 text-xs text-error-600">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Some profile details could not be loaded. Refresh to try again.
        </p>
      ) : null}
    </div>
  );
}
