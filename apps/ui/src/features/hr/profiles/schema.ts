import type {
  EmployeeProfileView,
  EmployeeSensitiveView,
  ProfileAddress,
} from "./types";

/**
 * Client-side UX validation only. It mirrors apps/api/src/modules/hr/profiles/
 * dto/profile.dto.ts so the form fails the way the API would, before a round
 * trip. The backend remains authoritative.
 */
const PHONE_PATTERN = /^[0-9+ ()-]{6,20}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PINCODE_PATTERN = /^[0-9A-Za-z -]{3,10}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_PATTERN = /^[0-9]{12}$/;
const ESI_PATTERN = /^[0-9]{10,17}$/;
const ACCOUNT_PATTERN = /^[0-9]{6,20}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const MAX_LANGUAGES = 10;

export interface AddressForm {
  address: string;
  area: string;
  district: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ProfileFormValues {
  title: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  /** Comma-separated in the form; normalised to a list on save. */
  languages: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  presentAddress: AddressForm;
  permanentAddress: AddressForm;
  isFresher: boolean;
  experienceYears: string;
  previousCompany: string;
  previousRole: string;
}

export const EMPTY_ADDRESS: AddressForm = {
  address: "",
  area: "",
  district: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  title: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  bloodGroup: "",
  languages: "",
  fatherName: "",
  motherName: "",
  spouseName: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
  presentAddress: EMPTY_ADDRESS,
  permanentAddress: EMPTY_ADDRESS,
  isFresher: false,
  experienceYears: "",
  previousCompany: "",
  previousRole: "",
};

const orEmpty = (v: string | null | undefined) => v ?? "";

function addressToForm(a: ProfileAddress | null): AddressForm {
  if (!a) return EMPTY_ADDRESS;
  return {
    address: a.address,
    area: orEmpty(a.area),
    district: orEmpty(a.district),
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: orEmpty(a.country),
  };
}

export function formFromProfile(view: EmployeeProfileView): ProfileFormValues {
  const p = view.profile;
  return {
    title: orEmpty(p.title),
    dateOfBirth: orEmpty(p.dateOfBirth),
    gender: orEmpty(p.gender),
    maritalStatus: orEmpty(p.maritalStatus),
    bloodGroup: orEmpty(p.bloodGroup),
    languages: p.languages.join(", "),
    fatherName: orEmpty(p.fatherName),
    motherName: orEmpty(p.motherName),
    spouseName: orEmpty(p.spouseName),
    emergencyName: orEmpty(p.emergencyContact.name),
    emergencyPhone: orEmpty(p.emergencyContact.phone),
    emergencyRelation: orEmpty(p.emergencyContact.relation),
    presentAddress: addressToForm(p.presentAddress),
    permanentAddress: addressToForm(p.permanentAddress),
    isFresher: p.isFresher,
    experienceYears:
      p.experienceYears === null ? "" : String(p.experienceYears),
    previousCompany: orEmpty(p.previousCompany),
    previousRole: orEmpty(p.previousRole),
  };
}

/** Form errors keyed by field; nested address keys look like `presentAddress.city`. */
export type FormErrors = Partial<Record<string, string>>;

function parseLanguages(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isAddressEmpty(a: AddressForm): boolean {
  return Object.values(a).every((v) => v.trim() === "");
}

function validateAddress(
  key: "presentAddress" | "permanentAddress",
  a: AddressForm,
  errors: FormErrors,
) {
  if (isAddressEmpty(a)) return;
  const required: Array<[keyof AddressForm, string, number]> = [
    ["address", "Address", 200],
    ["city", "City", 100],
    ["state", "State", 100],
  ];
  for (const [field, label, max] of required) {
    const v = a[field].trim();
    if (!v) errors[`${key}.${field}`] = `${label} is required`;
    else if (v.length > max)
      errors[`${key}.${field}`] = `${label} must be ${max} characters or fewer`;
  }
  const pin = a.pincode.trim();
  if (!pin) errors[`${key}.pincode`] = "Pincode is required";
  else if (!PINCODE_PATTERN.test(pin))
    errors[`${key}.pincode`] = "Enter a valid pincode";
  const optional: Array<[keyof AddressForm, string, number]> = [
    ["area", "Area", 100],
    ["district", "District", 100],
    ["country", "Country", 100],
  ];
  for (const [field, label, max] of optional) {
    if (a[field].trim().length > max)
      errors[`${key}.${field}`] = `${label} must be ${max} characters or fewer`;
  }
}

export function validateProfileForm(v: ProfileFormValues): FormErrors {
  const errors: FormErrors = {};
  const len = (field: keyof ProfileFormValues, max: number, label: string) => {
    if ((v[field] as string).trim().length > max)
      errors[field] = `${label} must be ${max} characters or fewer`;
  };
  len("title", 20, "Title");
  len("gender", 30, "Gender");
  len("maritalStatus", 30, "Marital status");
  len("bloodGroup", 10, "Blood group");
  len("fatherName", 120, "Father's name");
  len("motherName", 120, "Mother's name");
  len("spouseName", 120, "Spouse name");
  len("emergencyName", 120, "Emergency contact name");
  len("emergencyRelation", 60, "Relation");
  len("previousCompany", 120, "Previous company");
  len("previousRole", 120, "Previous role");

  const dob = v.dateOfBirth.trim();
  if (dob && !ISO_DATE.test(dob)) errors.dateOfBirth = "Use a valid date";

  const phone = v.emergencyPhone.trim();
  if (phone && !PHONE_PATTERN.test(phone))
    errors.emergencyPhone = "Phone must be 6–20 digits, spaces, + ( ) or -";

  const langs = parseLanguages(v.languages);
  if (langs.length > MAX_LANGUAGES)
    errors.languages = `Add no more than ${MAX_LANGUAGES} languages`;
  else if (langs.some((l) => l.length > 40))
    errors.languages = "Each language must be 40 characters or fewer";

  const exp = v.experienceYears.trim();
  if (exp) {
    const n = Number(exp);
    if (!Number.isFinite(n) || n < 0 || n > 60)
      errors.experienceYears = "Enter years between 0 and 60";
    else if (!/^\d+(\.\d)?$/.test(exp))
      errors.experienceYears = "Use at most one decimal place";
  }

  validateAddress("presentAddress", v.presentAddress, errors);
  validateAddress("permanentAddress", v.permanentAddress, errors);
  return errors;
}

/** Address as sent to the API, or null when every field is blank. Blank optional parts are omitted. */
function normaliseAddress(a: AddressForm): ProfileAddress | null {
  if (isAddressEmpty(a)) return null;
  const out: ProfileAddress = {
    address: a.address.trim(),
    city: a.city.trim(),
    state: a.state.trim(),
    pincode: a.pincode.trim(),
  };
  if (a.area.trim()) out.area = a.area.trim();
  if (a.district.trim()) out.district = a.district.trim();
  if (a.country.trim()) out.country = a.country.trim();
  return out;
}

const trimOrNull = (v: string): string | null => (v.trim() ? v.trim() : null);

/**
 * Partial update body: only the fields the user changed. Untouched fields are
 * never sent, so server values are not overwritten with blanks. A field the
 * user empties is sent as `null` (clears it).
 */
export function buildProfilePatch(
  initial: ProfileFormValues,
  v: ProfileFormValues,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const text: Array<[keyof ProfileFormValues, string]> = [
    ["title", "title"],
    ["gender", "gender"],
    ["maritalStatus", "maritalStatus"],
    ["bloodGroup", "bloodGroup"],
    ["fatherName", "fatherName"],
    ["motherName", "motherName"],
    ["spouseName", "spouseName"],
    ["emergencyName", "emergencyContactName"],
    ["emergencyPhone", "emergencyContactPhone"],
    ["emergencyRelation", "emergencyContactRelation"],
    ["previousCompany", "previousCompany"],
    ["previousRole", "previousRole"],
  ];
  for (const [field, apiKey] of text) {
    if ((initial[field] as string) !== (v[field] as string))
      body[apiKey] = trimOrNull(v[field] as string);
  }

  if (initial.dateOfBirth !== v.dateOfBirth)
    body.dateOfBirth = trimOrNull(v.dateOfBirth);

  if (initial.isFresher !== v.isFresher) body.isFresher = v.isFresher;

  const initLangs = parseLanguages(initial.languages);
  const nextLangs = parseLanguages(v.languages);
  if (JSON.stringify(initLangs) !== JSON.stringify(nextLangs))
    body.languages = nextLangs;

  if (initial.experienceYears.trim() !== v.experienceYears.trim()) {
    const exp = v.experienceYears.trim();
    body.experienceYears = exp ? Number(exp) : null;
  }

  for (const key of ["presentAddress", "permanentAddress"] as const) {
    const before = JSON.stringify(normaliseAddress(initial[key]));
    const after = normaliseAddress(v[key]);
    if (before !== JSON.stringify(after)) body[key] = after;
  }

  return body;
}

export function isProfileDirty(
  initial: ProfileFormValues,
  v: ProfileFormValues,
): boolean {
  return Object.keys(buildProfilePatch(initial, v)).length > 0;
}

/* ---------------- Statutory and bank (sensitive) ---------------- */

export interface SensitiveFormValues {
  panNumber: string;
  aadhaarNumber: string;
  esiNumber: string;
  pfNumber: string;
  bankName: string;
  bankBranch: string;
  bankAccountNo: string;
  bankIfsc: string;
}

export const EMPTY_SENSITIVE_FORM: SensitiveFormValues = {
  panNumber: "",
  aadhaarNumber: "",
  esiNumber: "",
  pfNumber: "",
  bankName: "",
  bankBranch: "",
  bankAccountNo: "",
  bankIfsc: "",
};

export function formFromSensitive(
  view: EmployeeSensitiveView,
): SensitiveFormValues {
  return {
    panNumber: orEmpty(view.panNumber),
    aadhaarNumber: orEmpty(view.aadhaarNumber),
    esiNumber: orEmpty(view.esiNumber),
    pfNumber: orEmpty(view.pfNumber),
    bankName: orEmpty(view.bankName),
    bankBranch: orEmpty(view.bankBranch),
    bankAccountNo: orEmpty(view.bankAccountNo),
    bankIfsc: orEmpty(view.bankIfsc),
  };
}

export function validateSensitiveForm(v: SensitiveFormValues): FormErrors {
  const errors: FormErrors = {};
  const check = (
    field: keyof SensitiveFormValues,
    pattern: RegExp | null,
    message: string,
    min?: number,
    max?: number,
  ) => {
    const value = v[field].trim();
    if (!value) return;
    if (min !== undefined && value.length < min) errors[field] = message;
    else if (max !== undefined && value.length > max) errors[field] = message;
    else if (pattern && !pattern.test(value)) errors[field] = message;
  };
  check("panNumber", PAN_PATTERN, "PAN must be 10 characters, e.g. ABCDE1234F");
  check("aadhaarNumber", AADHAAR_PATTERN, "Aadhaar must be 12 digits");
  check("esiNumber", ESI_PATTERN, "ESI must be 10 to 17 digits");
  check("pfNumber", null, "PF number must be 5 to 30 characters", 5, 30);
  check("bankName", null, "Bank name must be 2 to 100 characters", 2, 100);
  check("bankBranch", null, "Branch must be 2 to 100 characters", 2, 100);
  check(
    "bankAccountNo",
    ACCOUNT_PATTERN,
    "Account number must be 6 to 20 digits",
  );
  check("bankIfsc", IFSC_PATTERN, "IFSC must be valid, e.g. SBIN0001234");
  return errors;
}

export function buildSensitivePatch(
  initial: SensitiveFormValues,
  v: SensitiveFormValues,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  (Object.keys(v) as Array<keyof SensitiveFormValues>).forEach((field) => {
    if (initial[field] !== v[field]) body[field] = trimOrNull(v[field]);
  });
  return body;
}
