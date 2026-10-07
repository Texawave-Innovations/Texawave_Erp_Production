"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
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

/** Optional step: family members and past employers. Nothing here blocks
 * submission, so the user can add none and continue. */
export function FamilyExperienceStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        Both sections are optional. Add anyone you want on record, or continue
        without adding.
      </p>
      <FamilySection />
      <ExperienceSection />
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Continue to documents</Button>
      </div>
    </div>
  );
}

function FamilySection() {
  const family = useMyFamilyMembers();
  const [form, setForm] = useState({
    name: "",
    relation: "",
    dateOfBirth: "",
    contactPhone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.relation.trim()) {
      setError("Name and relation are required.");
      return;
    }
    setBusy(true);
    try {
      await addFamilyMember({
        name: form.name.trim(),
        relation: form.relation.trim(),
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
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
        <FormField label="Name" required>
          {(p) => (
            <Input
              {...p}
              value={form.name}
              disabled={busy}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Relation" required>
          {(p) => (
            <Input
              {...p}
              value={form.relation}
              disabled={busy}
              onChange={(e) => setForm({ ...form, relation: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Date of birth">
          {(p) => (
            <Input
              {...p}
              type="date"
              value={form.dateOfBirth}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, dateOfBirth: e.target.value })
              }
            />
          )}
        </FormField>
        <FormField label="Contact phone">
          {(p) => (
            <Input
              {...p}
              value={form.contactPhone}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
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
}

function ExperienceSection() {
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
        <FormField label="Employer" required>
          {(p) => (
            <Input
              {...p}
              value={form.employer}
              disabled={busy}
              onChange={(e) => setForm({ ...form, employer: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Designation" required>
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
        <FormField label="From" required>
          {(p) => (
            <Input
              {...p}
              type="date"
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
}
