"use client";

import { ApiError, familyMemberSchema } from "@texawave-erp/core";
import { Alert, Button, FormField, Input } from "@texawave-erp/ui-kit";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
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

/** Exposed by each sub-section so Continue can refuse to navigate while the
 * user has started filling an Add form but not submitted it — otherwise
 * typed-but-unsaved details silently vanish when the step changes. */
interface SectionHandle {
  hasPendingInput(): boolean;
}

/** Optional step: family members and past employers. Submitted (added)
 * entries are never required to continue, but an unsaved, partly-filled Add
 * form blocks navigation until it's finished or cleared. */
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

  function handleContinue() {
    const pendingFamily = familyRef.current?.hasPendingInput() ?? false;
    const pendingExperience = experienceRef.current?.hasPendingInput() ?? false;
    if (pendingFamily || pendingExperience) {
      setBlockedMessage(
        "You've started adding a " +
          [
            pendingFamily && "family member",
            pendingExperience && "work experience entry",
          ]
            .filter(Boolean)
            .join(" and ") +
          " but haven't saved it. Click Add to save it, or clear those fields, before continuing.",
      );
      return;
    }
    setBlockedMessage(null);
    onContinue();
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        Both sections are optional. Add anyone you want on record, or continue
        without adding.
      </p>
      {blockedMessage && (
        <Alert variant="warning" title="Unsaved details">
          {blockedMessage}
        </Alert>
      )}
      <FamilySection ref={familyRef} />
      <ExperienceSection ref={experienceRef} />
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue}>Continue to documents</Button>
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

  useImperativeHandle(
    ref,
    () => ({
      hasPendingInput: () => Object.values(form).some((v) => v.trim() !== ""),
    }),
    [form],
  );

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = familyMemberSchema.safeParse(form);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in out)) out[key] = issue.message;
      }
      setFieldErrors(out);
      return;
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
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium text-gray-900 dark:text-gray-100">
        Family members
      </h2>
      {error && (
        <Alert variant="error" title="Could not save">
          {error}
        </Alert>
      )}
      <ul className="flex flex-col gap-2">
        {(family.data ?? []).map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-gray-800"
          >
            <span className="text-theme-sm text-gray-800 dark:text-gray-200">
              {m.name} ({m.relation})
              {m.contactPhone ? ` · ${m.contactPhone}` : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onRemove(m.id)}
              aria-label={`Remove ${m.name}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={onAdd} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" error={fieldErrors.name}>
          {(p) => (
            <Input
              {...p}
              value={form.name}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, name: sanitizeName(e.target.value) })
              }
            />
          )}
        </FormField>
        <FormField label="Relation" error={fieldErrors.relation}>
          {(p) => (
            <Input
              {...p}
              value={form.relation}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, relation: sanitizeName(e.target.value) })
              }
            />
          )}
        </FormField>
        <FormField label="Date of birth" error={fieldErrors.dateOfBirth}>
          {(p) => (
            <Input
              {...p}
              type="date"
              min="1900-01-01"
              max={TODAY}
              value={form.dateOfBirth}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, dateOfBirth: e.target.value })
              }
            />
          )}
        </FormField>
        <FormField label="Contact phone" error={fieldErrors.contactPhone}>
          {(p) => (
            <Input
              {...p}
              value={form.contactPhone}
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
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            disabled={busy}
          >
            Add family member
          </Button>
        </div>
      </form>
    </section>
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

  useImperativeHandle(
    ref,
    () => ({
      hasPendingInput: () => Object.values(form).some((v) => v.trim() !== ""),
    }),
    [form],
  );

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.employer.trim() || !form.designation.trim() || !form.fromDate) {
      setError("Employer, designation and start date are required.");
      return;
    }
    setBusy(true);
    try {
      await addExperience({
        employer: form.employer.trim(),
        designation: form.designation.trim(),
        fromDate: form.fromDate,
        ...(form.toDate ? { toDate: form.toDate } : {}),
        ...(form.reasonForLeaving.trim()
          ? { reasonForLeaving: form.reasonForLeaving.trim() }
          : {}),
      });
      setForm({
        employer: "",
        designation: "",
        fromDate: "",
        toDate: "",
        reasonForLeaving: "",
      });
      await experience.refetch();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium text-gray-900 dark:text-gray-100">
        Work experience
      </h2>
      {error && (
        <Alert variant="error" title="Could not save">
          {error}
        </Alert>
      )}
      <ul className="flex flex-col gap-2">
        {(experience.data ?? []).map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-gray-800"
          >
            <span className="text-theme-sm text-gray-800 dark:text-gray-200">
              {e.designation} at {e.employer} ({e.fromDate} to{" "}
              {e.toDate ?? "present"})
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onRemove(e.id)}
              aria-label={`Remove ${e.employer}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={onAdd} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField label="Employer">
          {(p) => (
            <Input
              {...p}
              value={form.employer}
              disabled={busy}
              onChange={(e) => setForm({ ...form, employer: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Designation">
          {(p) => (
            <Input
              {...p}
              value={form.designation}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, designation: e.target.value })
              }
            />
          )}
        </FormField>
        <FormField label="From">
          {(p) => (
            <Input
              {...p}
              type="date"
              min="1900-01-01"
              max={TODAY}
              value={form.fromDate}
              disabled={busy}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="To (leave empty if current)">
          {(p) => (
            <Input
              {...p}
              type="date"
              min="1900-01-01"
              max={TODAY}
              value={form.toDate}
              disabled={busy}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Reason for leaving">
          {(p) => (
            <Input
              {...p}
              value={form.reasonForLeaving}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, reasonForLeaving: e.target.value })
              }
            />
          )}
        </FormField>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            disabled={busy}
          >
            Add experience
          </Button>
        </div>
      </form>
    </section>
  );
});
