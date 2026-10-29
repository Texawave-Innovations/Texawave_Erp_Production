"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import {
  getEmployeeAddress,
  getEmployeeBank,
  getEmployeeGovernmentIds,
  getEmployeePersonal,
  putEmployeeAddress,
  putEmployeeBank,
  putEmployeeGovernmentIds,
  putEmployeePersonal,
  uploadEmployeeDocument,
} from "@/features/hr/employees/api";

/** The section ids `EmployeeOnboardingProgress.tsx` defines; "documents" is
 * handled by its own upload rows rather than this form-style dialog. */
export type EditableSectionId =
  "personal" | "emergency" | "address" | "bank" | "statutory" | "documents";

export interface SectionEditDialogProps {
  employeeId: number;
  sectionId: EditableSectionId;
  onClose: () => void;
  /** Called after a successful save so the parent can refetch the checklist. */
  onSaved: () => void;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string")
    return value.slice(0, 10) === value ? value : String(value);
  return String(value);
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not save. Check your connection and try again.";
}

const DOCUMENT_ROWS: { type: string; label: string }[] = [
  { type: "PROFILE_PHOTO", label: "Profile photo" },
  { type: "AADHAAR", label: "Aadhaar card" },
  { type: "PAN", label: "PAN card" },
  { type: "BANK_STATEMENT", label: "Bank statement" },
  { type: "CERT_10TH", label: "10th certificate" },
  { type: "CERT_12TH", label: "12th certificate" },
  { type: "CERT_GRADUATION", label: "Graduation certificate" },
];

/**
 * HR's edit of one onboarding section on an employee's behalf — opened from
 * the per-section "Edit" action on the onboarding progress checklist. Each
 * section maps to one `employee_*` detail table (personal/emergency share
 * `employee_personal_details`); documents use file inputs instead of a form.
 * Saves go through `hr/employees/:id/...` (EmployeePersonalDataService),
 * the HR-side counterpart of the employee's own self-service writes.
 */
export function SectionEditDialog({
  employeeId,
  sectionId,
  onClose,
  onSaved,
}: SectionEditDialogProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docError, setDocError] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

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
  const [address, setAddress] = useState({
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

  const isPersonalLike = sectionId === "personal" || sectionId === "emergency";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isPersonalLike) {
          const row = await getEmployeePersonal(employeeId);
          if (cancelled) return;
          if (row) {
            setPersonal({
              dateOfBirth: str(row.dateOfBirth),
              gender: str(row.gender),
              maritalStatus: str(row.maritalStatus),
              bloodGroup: str(row.bloodGroup),
              emergencyContactName: str(row.emergencyContactName),
              emergencyContactRelation: str(row.emergencyContactRelation),
              emergencyContactPhone: str(row.emergencyContactPhone),
              fatherName: str(row.fatherName),
              fatherPhone: str(row.fatherPhone),
              motherName: str(row.motherName),
              motherPhone: str(row.motherPhone),
            });
          }
        } else if (sectionId === "address") {
          const row = await getEmployeeAddress(employeeId, "PERMANENT");
          if (cancelled) return;
          if (row) {
            setAddress({
              addressLine: str(row.addressLine),
              areaLocality: str(row.areaLocality),
              district: str(row.district),
              city: str(row.city),
              state: str(row.state),
              pincode: str(row.pincode),
            });
          }
        } else if (sectionId === "bank") {
          const row = await getEmployeeBank(employeeId);
          if (cancelled) return;
          if (row) {
            setBank({
              accountHolderName: str(row.accountHolderName),
              accountNumber: "",
              ifsc: str(row.ifsc),
              bankName: str(row.bankName),
              branchName: str(row.branchName),
            });
          }
        } else if (sectionId === "statutory") {
          const row = await getEmployeeGovernmentIds(employeeId);
          if (cancelled) return;
          if (row) {
            setIds({
              aadhaarNumber: str(row.aadhaarNumber),
              panNumber: str(row.panNumber),
              esiNumber: str(row.esiNumber),
              pfNumber: str(row.pfNumber),
            });
          }
        }
      } catch (err) {
        if (!cancelled) setError(apiMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() is stable per render; including it would refetch on every keystroke
  }, [employeeId, sectionId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (isPersonalLike) {
        await putEmployeePersonal(employeeId, {
          ...personal,
          maritalStatus: personal.maritalStatus || undefined,
          bloodGroup: personal.bloodGroup || undefined,
        });
      } else if (sectionId === "address") {
        await putEmployeeAddress(employeeId, "PERMANENT", address);
      } else if (sectionId === "bank") {
        await putEmployeeBank(employeeId, {
          ...bank,
          branchName: bank.branchName || undefined,
        });
      } else if (sectionId === "statutory") {
        await putEmployeeGovernmentIds(employeeId, {
          ...ids,
          esiNumber: ids.esiNumber || undefined,
          pfNumber: ids.pfNumber || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPickDocument(type: string, file: File | undefined) {
    if (!file) return;
    setDocError((prev) => ({ ...prev, [type]: "" }));
    setUploading(type);
    try {
      await uploadEmployeeDocument(employeeId, type, file);
      onSaved();
    } catch (err) {
      setDocError((prev) => ({ ...prev, [type]: apiMessage(err) }));
    } finally {
      setUploading(null);
    }
  }

  const titles: Record<EditableSectionId, string> = {
    personal: "Edit personal information",
    emergency: "Edit emergency contact",
    address: "Edit permanent address",
    bank: "Edit bank information",
    statutory: "Edit statutory identification",
    documents: "Upload compliance documents",
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
  ) => (
    <FormField label={label} required>
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
    <Dialog open onClose={onClose} title={titles[sectionId]} size="xl">
      {loading ? (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {error ? (
            <Alert variant="error" title="Could not save">
              {error}
            </Alert>
          ) : null}

          {isPersonalLike ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field(
                "Date of birth",
                personal.dateOfBirth,
                (v) => setPersonal({ ...personal, dateOfBirth: v }),
                "date",
              )}
              <FormField label="Gender" required>
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
                personal.emergencyContactName,
                (v) => setPersonal({ ...personal, emergencyContactName: v }),
              )}
              {field(
                "Emergency contact relation",
                personal.emergencyContactRelation,
                (v) =>
                  setPersonal({ ...personal, emergencyContactRelation: v }),
              )}
              {field(
                "Emergency contact phone",
                personal.emergencyContactPhone,
                (v) => setPersonal({ ...personal, emergencyContactPhone: v }),
              )}
              {field("Father's name", personal.fatherName, (v) =>
                setPersonal({ ...personal, fatherName: v }),
              )}
              {field("Father's phone", personal.fatherPhone, (v) =>
                setPersonal({ ...personal, fatherPhone: v }),
              )}
              {field("Mother's name", personal.motherName, (v) =>
                setPersonal({ ...personal, motherName: v }),
              )}
              {field("Mother's phone", personal.motherPhone, (v) =>
                setPersonal({ ...personal, motherPhone: v }),
              )}
            </div>
          ) : null}

          {sectionId === "address" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("Address line", address.addressLine, (v) =>
                setAddress({ ...address, addressLine: v }),
              )}
              <FormField label="Area / locality">
                {(p) => (
                  <Input
                    {...p}
                    value={address.areaLocality}
                    disabled={busy}
                    onChange={(e) =>
                      setAddress({ ...address, areaLocality: e.target.value })
                    }
                  />
                )}
              </FormField>
              {field("District", address.district, (v) =>
                setAddress({ ...address, district: v }),
              )}
              {field("City", address.city, (v) =>
                setAddress({ ...address, city: v }),
              )}
              {field("State", address.state, (v) =>
                setAddress({ ...address, state: v }),
              )}
              {field("Pincode", address.pincode, (v) =>
                setAddress({ ...address, pincode: v }),
              )}
            </div>
          ) : null}

          {sectionId === "bank" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("Account holder name", bank.accountHolderName, (v) =>
                setBank({ ...bank, accountHolderName: v }),
              )}
              {field("Account number", bank.accountNumber, (v) =>
                setBank({ ...bank, accountNumber: v }),
              )}
              {field("IFSC code", bank.ifsc, (v) =>
                setBank({ ...bank, ifsc: v }),
              )}
              {field("Bank name", bank.bankName, (v) =>
                setBank({ ...bank, bankName: v }),
              )}
              <FormField label="Branch name">
                {(p) => (
                  <Input
                    {...p}
                    value={bank.branchName}
                    disabled={busy}
                    onChange={(e) =>
                      setBank({ ...bank, branchName: e.target.value })
                    }
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {sectionId === "statutory" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("Aadhaar number", ids.aadhaarNumber, (v) =>
                setIds({ ...ids, aadhaarNumber: v }),
              )}
              {field("PAN number", ids.panNumber, (v) =>
                setIds({ ...ids, panNumber: v }),
              )}
              <FormField label="ESI number">
                {(p) => (
                  <Input
                    {...p}
                    value={ids.esiNumber}
                    disabled={busy}
                    onChange={(e) =>
                      setIds({ ...ids, esiNumber: e.target.value })
                    }
                  />
                )}
              </FormField>
              <FormField label="PF (UAN) number">
                {(p) => (
                  <Input
                    {...p}
                    value={ids.pfNumber}
                    disabled={busy}
                    onChange={(e) =>
                      setIds({ ...ids, pfNumber: e.target.value })
                    }
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {sectionId === "documents" ? (
            <ul className="flex flex-col gap-3">
              {DOCUMENT_ROWS.map((row) => (
                <li
                  key={row.type}
                  className="flex flex-col gap-2 rounded-xl border border-sky-200/90 p-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-theme-sm font-medium text-[#0a3271] dark:text-sky-100">
                      {row.label}
                    </p>
                    {docError[row.type] ? (
                      <p
                        role="alert"
                        className="text-theme-xs text-red-600 dark:text-red-400"
                      >
                        {docError[row.type]}
                      </p>
                    ) : null}
                  </div>
                  <label className="text-theme-sm">
                    <span className="sr-only">Upload {row.label}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        void onPickDocument(row.type, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {uploading === row.type ? (
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      Uploading…
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {sectionId !== "documents" ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void save()}
                loading={busy}
                disabled={busy}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
