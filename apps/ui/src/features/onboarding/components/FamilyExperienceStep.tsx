"use client";

import { ApiError, familyMemberSchema } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
} from "@texawave-erp/ui-kit";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  addExperience,
  addFamilyMember,
  removeExperience,
  removeFamilyMember,
} from "../api";
import { useMyExperience, useMyFamilyMembers } from "../hooks";

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not save. Check your connection and try again.";
}

const TODAY = new Date().toISOString().slice(0, 10);

const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z .'-]/g, "");
const sanitizePhone = (raw: string) => raw.replace(/\D/g, "").slice(0, 10);

/** Exposed by each sub-section so Continue can auto-save pending input or report validation */
interface SectionHandle {
  hasPendingInput(): boolean;
  savePending(): Promise<boolean>;
}

/** Optional step: family members and past employers. Submitted (added)
 * entries are never required to continue. If the user typed pending input,
 * Continue automatically saves it before advancing. */
export function FamilyExperienceStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const familyRef = useRef<SectionHandle>(null);
  const experienceRef = useRef<SectionHandle>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  async function handleContinue() {
    setBlockedMessage(null);
    setContinuing(true);
    try {
      // Auto-save pending family input if user filled it out and clicked Continue
      if (familyRef.current?.hasPendingInput()) {
        const familySaved = await familyRef.current.savePending();
        if (!familySaved) {
          setBlockedMessage(
            "Please complete the required family member fields or clear them before continuing.",
          );
          return;
        }
      }

      // Auto-save pending experience input if user filled it out and clicked Continue
      if (experienceRef.current?.hasPendingInput()) {
        const expSaved = await experienceRef.current.savePending();
        if (!expSaved) {
          setBlockedMessage(
            "Please complete employer, designation, and from date, or clear them before continuing.",
          );
          return;
        }
      }

      onContinue();
    } finally {
      setContinuing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {blockedMessage && (
        <Alert variant="warning" title="Incomplete Form Input">
          {blockedMessage}
        </Alert>
      )}

      {/* Sub-section 1: Family Members */}
      <FamilySection ref={familyRef} />

      {/* Sub-section 2: Work Experience */}
      <ExperienceSection ref={experienceRef} />

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-sky-100 dark:border-slate-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={continuing}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Bank & IDs</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleContinue()}
          loading={continuing}
          disabled={continuing}
          className="flex items-center gap-2 px-6"
        >
          <span>Continue to Document Uploads</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const FamilySection = forwardRef(function FamilySection(
  _props,
  ref: Ref<SectionHandle>,
) {
  const family = useMyFamilyMembers();
  const [form, setForm] = useState({
    name: "",
    relation: "",
    dateOfBirth: "",
    contactPhone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submitForm(): Promise<boolean> {
    setError(null);
    const parsed = familyMemberSchema.safeParse(form);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in out)) out[key] = issue.message;
      }
      setFieldErrors(out);
      return false;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await addFamilyMember({
        name: parsed.data.name,
        relation: parsed.data.relation,
        ...(parsed.data.dateOfBirth
          ? { dateOfBirth: parsed.data.dateOfBirth }
          : {}),
        ...(parsed.data.contactPhone
          ? { contactPhone: parsed.data.contactPhone }
          : {}),
      });
      setForm({ name: "", relation: "", dateOfBirth: "", contactPhone: "" });
      await family.refetch();
      return true;
    } catch (err) {
      setError(apiMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      hasPendingInput: () => Object.values(form).some((v) => v.trim() !== ""),
      savePending: async () => {
        if (!Object.values(form).some((v) => v.trim() !== "")) return true;
        return await submitForm();
      },
    }),
    [form],
  );

  async function onRemove(id: number) {
    setError(null);
    setBusy(true);
    try {
      await removeFamilyMember(id);
      await family.refetch();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const members = family.data ?? [];

  return (
    <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
          <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
            Family Members (Optional)
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {members.length} {members.length === 1 ? "member" : "members"}{" "}
          recorded
        </span>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Could not save family member"
          className="mb-4"
        >
          {error}
        </Alert>
      )}

      {/* Existing Members List */}
      {members.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-brand-700 font-bold text-xs dark:bg-slate-800 dark:text-cyan-300">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0a3271] dark:text-white">
                      {m.name}
                    </span>
                    <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-slate-800 dark:text-cyan-300">
                      {m.relation}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {m.dateOfBirth && <span>DOB: {m.dateOfBirth}</span>}
                    {m.contactPhone && <span>Phone: {m.contactPhone}</span>}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onRemove(m.id)}
                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Family Member Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm();
        }}
        noValidate
        className="rounded-xl border border-sky-100/90 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50"
      >
        <p className="text-[11px] font-bold text-[#2f6396] uppercase tracking-wider mb-3 dark:text-sky-300">
          Add New Member
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Member name" error={fieldErrors.name}>
            {(p) => (
              <Input
                {...p}
                value={form.name}
                placeholder="Full name"
                disabled={busy}
                onChange={(e) =>
                  setForm({ ...form, name: sanitizeName(e.target.value) })
                }
              />
            )}
          </FormField>
          <FormField label="Relationship" error={fieldErrors.relation}>
            {(p) => (
              <Input
                {...p}
                value={form.relation}
                placeholder="e.g. Spouse, Son, Daughter"
                disabled={busy}
                onChange={(e) =>
                  setForm({ ...form, relation: sanitizeName(e.target.value) })
                }
              />
            )}
          </FormField>
          <FormField label="Date of birth" error={fieldErrors.dateOfBirth}>
            {(p) => (
              <DatePicker
                {...p}
                minDate="1900-01-01"
                maxDate={TODAY}
                value={form.dateOfBirth}
                disabled={busy}
                onChangeDate={(d) => setForm({ ...form, dateOfBirth: d })}
              />
            )}
          </FormField>
          <FormField label="Contact phone" error={fieldErrors.contactPhone}>
            {(p) => (
              <Input
                {...p}
                value={form.contactPhone}
                placeholder="10 digits (optional)"
                disabled={busy}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contactPhone: sanitizePhone(e.target.value),
                  })
                }
              />
            )}
          </FormField>
        </div>

        {/* Buttons: Save Family Member + Add Family Member */}
        <div className="flex items-center justify-end gap-2.5 pt-3 mt-3 border-t border-sky-50 dark:border-slate-800">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={busy}
            className="flex items-center gap-1.5 px-4"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Save Family Member</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => void submitForm()}
            className="flex items-center gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member</span>
          </Button>
        </div>
      </form>
    </div>
  );
});

const ExperienceSection = forwardRef(function ExperienceSection(
  _props,
  ref: Ref<SectionHandle>,
) {
  const experience = useMyExperience();
  const [form, setForm] = useState({
    employer: "",
    designation: "",
    fromDate: "",
    toDate: "",
    reasonForLeaving: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitForm(): Promise<boolean> {
    if (!form.employer.trim() || !form.designation.trim() || !form.fromDate) {
      setError(
        "Employer, designation, and from date are required to save experience.",
      );
      return false;
    }
    setError(null);
    setBusy(true);
    try {
      await addExperience({
        employer: form.employer,
        designation: form.designation,
        fromDate: form.fromDate,
        toDate: form.toDate || null,
        reasonForLeaving: form.reasonForLeaving || null,
      });
      setForm({
        employer: "",
        designation: "",
        fromDate: "",
        toDate: "",
        reasonForLeaving: "",
      });
      await experience.refetch();
      return true;
    } catch (err) {
      setError(apiMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      hasPendingInput: () => Object.values(form).some((v) => v.trim() !== ""),
      savePending: async () => {
        if (!Object.values(form).some((v) => v.trim() !== "")) return true;
        return await submitForm();
      },
    }),
    [form],
  );

  async function onRemove(id: number) {
    setError(null);
    setBusy(true);
    try {
      await removeExperience(id);
      await experience.refetch();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const entries = experience.data ?? [];

  return (
    <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
          <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
            Past Work Experience (Optional)
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {entries.length} {entries.length === 1 ? "role" : "roles"} recorded
        </span>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Could not save experience"
          className="mb-4"
        >
          {error}
        </Alert>
      )}

      {/* Existing Experience List */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-brand-700 font-bold text-xs dark:bg-slate-800 dark:text-cyan-300">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0a3271] dark:text-white">
                      {e.designation}
                    </span>
                    <span className="text-slate-400">at</span>
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                      {e.employer}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>
                      {e.fromDate} → {e.toDate ?? "Present"}
                    </span>
                    {e.reasonForLeaving && (
                      <>
                        <span>·</span>
                        <span>Reason: {e.reasonForLeaving}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onRemove(e.id)}
                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                aria-label={`Remove ${e.employer}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Work Experience Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm();
        }}
        noValidate
        className="rounded-xl border border-sky-100/90 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50"
      >
        <p className="text-[11px] font-bold text-[#2f6396] uppercase tracking-wider mb-3 dark:text-sky-300">
          Add Past Employer
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Employer / Company name">
            {(p) => (
              <Input
                {...p}
                value={form.employer}
                placeholder="e.g. Infosys, TCS, Tech Corp"
                disabled={busy}
                onChange={(e) => setForm({ ...form, employer: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Designation / Role">
            {(p) => (
              <Input
                {...p}
                value={form.designation}
                placeholder="e.g. Senior Software Engineer"
                disabled={busy}
                onChange={(e) =>
                  setForm({ ...form, designation: e.target.value })
                }
              />
            )}
          </FormField>
          <FormField label="From date">
            {(p) => (
              <DatePicker
                {...p}
                minDate="1900-01-01"
                maxDate={TODAY}
                value={form.fromDate}
                disabled={busy}
                onChangeDate={(d) => setForm({ ...form, fromDate: d })}
              />
            )}
          </FormField>
          <FormField label="To date (leave empty if current)">
            {(p) => (
              <DatePicker
                {...p}
                minDate="1900-01-01"
                maxDate={TODAY}
                value={form.toDate}
                disabled={busy}
                onChangeDate={(d) => setForm({ ...form, toDate: d })}
              />
            )}
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Reason for leaving">
              {(p) => (
                <Input
                  {...p}
                  value={form.reasonForLeaving}
                  placeholder="e.g. Career growth, Relocation (optional)"
                  disabled={busy}
                  onChange={(e) =>
                    setForm({ ...form, reasonForLeaving: e.target.value })
                  }
                />
              )}
            </FormField>
          </div>
        </div>

        {/* Buttons: Save Experience + Add Experience */}
        <div className="flex items-center justify-end gap-2.5 pt-3 mt-3 border-t border-sky-50 dark:border-slate-800">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={busy}
            className="flex items-center gap-1.5 px-4"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Save Experience</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => void submitForm()}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Experience</span>
          </Button>
        </div>
      </form>
    </div>
  );
});
