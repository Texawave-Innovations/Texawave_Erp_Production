"use client";

import { Button } from "@/components/legacy-ui/button";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import { AccountPicker } from "../../accounts/components/AccountPicker";
import {
  createContactSchema,
  type CreateContactFormValues,
} from "@texawave-erp/core";
import { Users } from "lucide-react";
import { useState } from "react";

export interface ContactFormProps {
  title: string;
  initialValues?: Partial<CreateContactFormValues> | undefined;
  onSubmit: (values: CreateContactFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Legacy Contacts.tsx full-page create/edit form. Save is blocked without
 * name + account, exactly as legacy (`!form.name.trim() || !form.accountId`). */
export function ContactForm({
  title,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ContactFormProps) {
  const [accountId, setAccountId] = useState<number | undefined>(
    initialValues?.accountId,
  );
  const [name, setName] = useState(initialValues?.name ?? "");
  const [designation, setDesignation] = useState(
    initialValues?.designation ?? "",
  );
  const [department, setDepartment] = useState(initialValues?.department ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [isPrimary, setIsPrimary] = useState(initialValues?.isPrimary ?? false);
  const [isDecisionMaker, setIsDecisionMaker] = useState(
    initialValues?.isDecisionMaker ?? false,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !accountId) return;
    const result = createContactSchema.safeParse({
      accountId,
      name,
      designation,
      department,
      email,
      phone,
      whatsapp: initialValues?.whatsapp,
      isPrimary,
      isDecisionMaker,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError("Failed to save contact. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-400">
              Every person across every Account, in one place.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Account *
            </Label>
            <AccountPicker value={accountId} onChange={setAccountId} />
            {fieldError("accountId")}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Full Name *
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldError("name")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Designation
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            {fieldError("designation")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Department
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            {fieldError("department")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Email</Label>
            <Input
              className="h-9 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldError("email")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Phone</Label>
            <Input
              className="h-9 rounded-xl"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {fieldError("phone")}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isPrimary}
              onCheckedChange={(v) => setIsPrimary(!!v)}
            />
            <Label className="text-sm font-normal">Primary Contact</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isDecisionMaker}
              onCheckedChange={(v) => setIsDecisionMaker(!!v)}
            />
            <Label className="text-sm font-normal">Decision Maker</Label>
          </div>
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => void handleSave()}
            disabled={!name.trim() || !accountId || saving}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
