"use client";

import {
  addressSchema,
  bankDetailsSchema,
  governmentIdsSchema,
  personalDetailsSchema,
  ApiError,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearPresentAddress,
  saveAddress,
  saveBank,
  saveGovernmentIds,
  savePersonal,
  submitOnboarding,
  uploadDocument,
} from "../api";
import { useMyDocuments } from "../hooks";
import { FamilyExperienceStep } from "./FamilyExperienceStep";

const STEPS = [
  "Personal",
  "Address",
  "Bank & IDs",
  "Family & experience",
  "Documents",
  "Review & submit",
] as const;

/** Friendly names for the server's "missing" keys (see onboarding-completeness.ts). */
export const MISSING_LABELS: Record<string, string> = {
  "personal.dateOfBirth": "Date of birth",
  "personal.gender": "Gender",
  "personal.emergencyContactName": "Emergency contact name",
  "personal.emergencyContactRelation": "Emergency contact relation",
  "personal.emergencyContactPhone": "Emergency contact phone",
  "personal.fatherName": "Father's name",
  "personal.fatherPhone": "Father's phone",
  "personal.motherName": "Mother's name",
  "personal.motherPhone": "Mother's phone",
  "permanentAddress.addressLine": "Permanent address line",
  "permanentAddress.district": "Permanent district",
  "permanentAddress.city": "Permanent city",
  "permanentAddress.state": "Permanent state",
  "permanentAddress.pincode": "Permanent pincode",
  "bank.accountHolderName": "Account holder name",
  "bank.accountNumberEncrypted": "Bank account number",
  "bank.ifsc": "IFSC code",
  "bank.bankName": "Bank name",
  "governmentIds.aadhaarNumber": "Aadhaar number",
  "governmentIds.panNumber": "PAN number",
};

type Errors = Record<string, string>;

function collectErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Errors {
  const out: Errors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not save. Check your connection and try again.";
}

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [missing, setMissing] = useState<string[] | null>(null);

  // Values are held locally per step, so a failed save never clears what was typed.
  const [personal, setPersonal] = useState({
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: "",
  });
  const [permanent, setPermanent] = useState({
    addressLine: "",
    areaLocality: "",
    district: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [sameAsPermanent, setSameAsPermanent] = useState(true);
  const [present, setPresent] = useState({
    addressLine: "",
    areaLocality: "",
    district: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [bank, setBank] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    branchName: "",
  });
  const [ids, setIds] = useState({
    aadhaarNumber: "",
    panNumber: "",
    esiNumber: "",
    pfNumber: "",
  });

  async function run(action: () => Promise<unknown>, next: () => void) {
    setSaveError(null);
    setBusy(true);
    try {
      await action();
      next();
    } catch (error) {
      setSaveError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function savePersonalStep(event: React.FormEvent) {
    event.preventDefault();
    const parsed = personalDetailsSchema.safeParse({
      ...personal,
      maritalStatus: personal.maritalStatus || undefined,
      bloodGroup: personal.bloodGroup || undefined,
    });
    if (!parsed.success) return setErrors(collectErrors(parsed.error.issues));
    setErrors({});
    void run(
      () => savePersonal(parsed.data),
      () => setStep(1),
    );
  }

  function saveAddressStep(event: React.FormEvent) {
    event.preventDefault();
    const perm = addressSchema.safeParse(permanent);
    const pres = sameAsPermanent ? null : addressSchema.safeParse(present);
    if (!perm.success) return setErrors(collectErrors(perm.error.issues));
    if (pres && !pres.success)
      return setErrors(collectErrors(pres.error.issues));
    setErrors({});
    void run(
      async () => {
        await saveAddress("PERMANENT", perm.data);
        if (pres?.success) await saveAddress("PRESENT", pres.data);
        else await clearPresentAddress();
      },
      () => setStep(2),
    );
  }

  function saveBankStep(event: React.FormEvent) {
    event.preventDefault();
    const bankParsed = bankDetailsSchema.safeParse({
      ...bank,
      branchName: bank.branchName || undefined,
    });
    const idParsed = governmentIdsSchema.safeParse({
      ...ids,
      esiNumber: ids.esiNumber || undefined,
      pfNumber: ids.pfNumber || undefined,
    });
    const issues = [
      ...(bankParsed.success ? [] : bankParsed.error.issues),
      ...(idParsed.success ? [] : idParsed.error.issues),
    ];
    if (issues.length) return setErrors(collectErrors(issues));
    if (!bankParsed.success || !idParsed.success) return;
    setErrors({});
    void run(
      async () => {
        await saveBank(bankParsed.data);
        await saveGovernmentIds(idParsed.data);
      },
      () => setStep(3),
    );
  }

  async function submit() {
    setSaveError(null);
    setBusy(true);
    try {
      const result = await submitOnboarding();
      if (result.missing.length > 0) {
        setMissing(result.missing);
      } else {
        await queryClient.invalidateQueries();
        router.replace("/portal");
      }
    } catch (error) {
      setSaveError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const field = (
    label: string,
    key: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    required = true,
  ) => (
    <FormField label={label} required={required} error={errors[key]}>
      {(p) => (
        <Input
          {...p}
          type={type}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <Card className="p-6">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-gray-100">
        Complete your profile
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}. Each step is saved as
        you go.
      </p>

      {saveError && (
        <div className="mt-4">
          <Alert variant="error" title="Could not save">
            {saveError}
          </Alert>
        </div>
      )}

      {step === 0 && (
        <form
          onSubmit={savePersonalStep}
          noValidate
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          {field(
            "Date of birth",
            "dateOfBirth",
            personal.dateOfBirth,
            (v) => setPersonal({ ...personal, dateOfBirth: v }),
            "date",
          )}
          <FormField label="Gender" required error={errors.gender}>
            {(p) => (
              <Select
                {...p}
                value={personal.gender}
                disabled={busy}
                onChange={(e) =>
                  setPersonal({ ...personal, gender: e.target.value })
                }
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            )}
          </FormField>
          {field(
            "Emergency contact name",
            "emergencyContactName",
            personal.emergencyContactName,
            (v) => setPersonal({ ...personal, emergencyContactName: v }),
          )}
          {field(
            "Emergency contact relation",
            "emergencyContactRelation",
            personal.emergencyContactRelation,
            (v) => setPersonal({ ...personal, emergencyContactRelation: v }),
          )}
          {field(
            "Emergency contact phone",
            "emergencyContactPhone",
            personal.emergencyContactPhone,
            (v) => setPersonal({ ...personal, emergencyContactPhone: v }),
          )}
          {field("Father's name", "fatherName", personal.fatherName, (v) =>
            setPersonal({ ...personal, fatherName: v }),
          )}
          {field("Father's phone", "fatherPhone", personal.fatherPhone, (v) =>
            setPersonal({ ...personal, fatherPhone: v }),
          )}
          {field("Mother's name", "motherName", personal.motherName, (v) =>
            setPersonal({ ...personal, motherName: v }),
          )}
          {field("Mother's phone", "motherPhone", personal.motherPhone, (v) =>
            setPersonal({ ...personal, motherPhone: v }),
          )}
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={busy} disabled={busy}>
              Save and continue
            </Button>
          </div>
        </form>
      )}

      {step === 1 && (
        <form
          onSubmit={saveAddressStep}
          noValidate
          className="mt-6 flex flex-col gap-6"
        >
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-medium text-gray-900 dark:text-gray-100">
              Permanent address
            </legend>
            {field("Address line", "addressLine", permanent.addressLine, (v) =>
              setPermanent({ ...permanent, addressLine: v }),
            )}
            {field(
              "Area / locality",
              "areaLocality",
              permanent.areaLocality,
              (v) => setPermanent({ ...permanent, areaLocality: v }),
              "text",
              false,
            )}
            {field("District", "district", permanent.district, (v) =>
              setPermanent({ ...permanent, district: v }),
            )}
            {field("City", "city", permanent.city, (v) =>
              setPermanent({ ...permanent, city: v }),
            )}
            {field("State", "state", permanent.state, (v) =>
              setPermanent({ ...permanent, state: v }),
            )}
            {field("Pincode", "pincode", permanent.pincode, (v) =>
              setPermanent({ ...permanent, pincode: v }),
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
            <Checkbox
              checked={sameAsPermanent}
              disabled={busy}
              onChange={(e) => setSameAsPermanent(e.target.checked)}
            />
            <span>Present address is the same as permanent</span>
          </label>

          {!sameAsPermanent && (
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 font-medium text-gray-900 dark:text-gray-100">
                Present address
              </legend>
              {field("Address line", "addressLine", present.addressLine, (v) =>
                setPresent({ ...present, addressLine: v }),
              )}
              {field(
                "Area / locality",
                "areaLocality",
                present.areaLocality,
                (v) => setPresent({ ...present, areaLocality: v }),
                "text",
                false,
              )}
              {field("District", "district", present.district, (v) =>
                setPresent({ ...present, district: v }),
              )}
              {field("City", "city", present.city, (v) =>
                setPresent({ ...present, city: v }),
              )}
              {field("State", "state", present.state, (v) =>
                setPresent({ ...present, state: v }),
              )}
              {field("Pincode", "pincode", present.pincode, (v) =>
                setPresent({ ...present, pincode: v }),
              )}
            </fieldset>
          )}

          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={() => setStep(0)}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="submit" loading={busy} disabled={busy}>
              Save and continue
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={saveBankStep}
          noValidate
          className="mt-6 flex flex-col gap-6"
        >
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-medium text-gray-900 dark:text-gray-100">
              Bank details
            </legend>
            {field(
              "Account holder name",
              "accountHolderName",
              bank.accountHolderName,
              (v) => setBank({ ...bank, accountHolderName: v }),
            )}
            {field("Account number", "accountNumber", bank.accountNumber, (v) =>
              setBank({ ...bank, accountNumber: v }),
            )}
            {field("IFSC code", "ifsc", bank.ifsc, (v) =>
              setBank({ ...bank, ifsc: v }),
            )}
            {field("Bank name", "bankName", bank.bankName, (v) =>
              setBank({ ...bank, bankName: v }),
            )}
            {field(
              "Branch name",
              "branchName",
              bank.branchName,
              (v) => setBank({ ...bank, branchName: v }),
              "text",
              false,
            )}
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-medium text-gray-900 dark:text-gray-100">
              Government IDs
            </legend>
            {field("Aadhaar number", "aadhaarNumber", ids.aadhaarNumber, (v) =>
              setIds({ ...ids, aadhaarNumber: v }),
            )}
            {field("PAN number", "panNumber", ids.panNumber, (v) =>
              setIds({ ...ids, panNumber: v }),
            )}
            {field(
              "ESI number",
              "esiNumber",
              ids.esiNumber,
              (v) => setIds({ ...ids, esiNumber: v }),
              "text",
              false,
            )}
            {field(
              "PF (UAN) number",
              "pfNumber",
              ids.pfNumber,
              (v) => setIds({ ...ids, pfNumber: v }),
              "text",
              false,
            )}
          </fieldset>
          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={() => setStep(1)}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="submit" loading={busy} disabled={busy}>
              Save and continue
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <FamilyExperienceStep
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <DocumentsStep
          onBack={() => setStep(3)}
          onContinue={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-theme-sm text-gray-700 dark:text-gray-300">
            Submitting checks that everything required is in place. Anything
            still missing is listed below.
          </p>
          {missing && missing.length > 0 && (
            <Alert variant="warning" title="Still missing">
              <ul className="list-disc pl-5">
                {missing.map((key) => (
                  <li key={key}>
                    {MISSING_LABELS[key] ??
                      key.replace(/^document\./, "Document: ")}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={() => setStep(4)}
              disabled={busy}
            >
              Back
            </Button>
            <Button
              onClick={() => void submit()}
              loading={busy}
              disabled={busy}
            >
              Submit profile
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const DOCUMENT_ROWS: { type: string; label: string; required: boolean }[] = [
  { type: "PROFILE_PHOTO", label: "Profile photo", required: true },
  { type: "AADHAAR", label: "Aadhaar card", required: true },
  { type: "PAN", label: "PAN card", required: true },
  { type: "BANK_STATEMENT", label: "Bank statement", required: true },
  { type: "CERT_10TH", label: "10th certificate", required: true },
  { type: "CERT_12TH", label: "12th certificate", required: true },
  { type: "CERT_GRADUATION", label: "Graduation certificate", required: true },
  { type: "RESUME", label: "Resume (PDF)", required: false },
  {
    type: "CERT_POST_GRADUATION",
    label: "Post-graduation certificate",
    required: false,
  },
];

function DocumentsStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const documents = useMyDocuments();
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const uploadedTypes = new Set(
    (documents.data ?? []).map((d) => d.documentType),
  );
  const uploadedName = (type: string) =>
    (documents.data ?? []).find((d) => d.documentType === type)?.fileName;

  async function onPick(type: string, file: File | undefined) {
    if (!file) return;
    setRowError((prev) => ({ ...prev, [type]: "" }));
    if (file.size > MAX_UPLOAD_BYTES) {
      setRowError((prev) => ({
        ...prev,
        [type]: "File must be 5 MB or smaller.",
      }));
      return;
    }
    setUploading(type);
    try {
      await uploadDocument(type, file);
      await documents.refetch();
    } catch (error) {
      setRowError((prev) => ({ ...prev, [type]: apiMessage(error) }));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        Upload a PDF, JPG or PNG for each item, 5 MB or smaller. Items marked
        optional can be left out.
      </p>
      <ul className="flex flex-col gap-3">
        {DOCUMENT_ROWS.map((row) => (
          <li
            key={row.type}
            className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {row.label}
                {row.required ? "" : " (optional)"}
              </p>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                {uploadedTypes.has(row.type)
                  ? `Uploaded: ${uploadedName(row.type)}`
                  : "Not uploaded yet"}
              </p>
              {rowError[row.type] && (
                <p
                  role="alert"
                  className="text-theme-sm text-red-600 dark:text-red-400"
                >
                  {rowError[row.type]}
                </p>
              )}
            </div>
            <label className="text-theme-sm">
              <span className="sr-only">Upload {row.label}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                disabled={uploading !== null}
                onChange={(e) => {
                  void onPick(row.type, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {uploading === row.type && (
              <span className="text-theme-sm text-gray-500 dark:text-gray-400">
                Uploading…
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue to review</Button>
      </div>
    </div>
  );
}
