"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Contact } from "@texawave-erp/api-types";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import { Checkbox } from "@/components/legacy-ui/checkbox";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { celebrateCrm } from "@/features/crm/celebration";
import {
  useCreateContact,
  useDeleteContact,
} from "@/features/crm/contacts/hooks";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { usePermission } from "@/hooks/usePermission";
import {
  CRM_DELETE_BTN_CLASS,
  FormRow,
  InlineFormPanel,
  SectionShell,
  TABLE_HEAD_STYLE,
  TH_CLASS,
} from "../accountUi";

const CONTACT_WRITE = [
  "crm.contact.write.own",
  "crm.contact.write.team",
  "crm.contact.write.all",
] as const;

function ContactInlineForm({
  accountId,
  onCancel,
  onSaved,
}: {
  accountId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const createMutation = useCreateContact();
  const [form, setForm] = useState({
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    whatsapp: "",
    isPrimary: false,
    isDecisionMaker: false,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        accountId,
        name: form.name.trim(),
        designation: opt(form.designation),
        department: opt(form.department),
        email: opt(form.email),
        phone: opt(form.phone),
        whatsapp: opt(form.whatsapp),
        isPrimary: form.isPrimary,
        isDecisionMaker: form.isDecisionMaker,
      });
      celebrateCrm("contact.created");
      onSaved();
    } catch {
      toast.error("Failed to add contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineFormPanel
      icon={Users}
      title="Add Contact"
      subtitle="Add a person you deal with at this account."
      onCancel={onCancel}
      onSubmit={() => void save()}
      submitLabel="Add Contact"
      saving={saving}
      canSubmit={Boolean(form.name.trim())}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <FormRow label="Name" required className="md:col-span-2">
          <Input
            className="h-9 rounded-xl"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </FormRow>
        <FormRow label="Designation">
          <Input
            className="h-9 rounded-xl"
            value={form.designation}
            onChange={(e) => set("designation", e.target.value)}
          />
        </FormRow>
        <FormRow label="Department">
          <Input
            className="h-9 rounded-xl"
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          />
        </FormRow>
        <FormRow label="Email">
          <Input
            className="h-9 rounded-xl"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </FormRow>
        <FormRow label="Phone">
          <Input
            className="h-9 rounded-xl"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormRow>
        <FormRow label="WhatsApp">
          <Input
            className="h-9 rounded-xl"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
          />
        </FormRow>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
          <Checkbox
            checked={form.isPrimary}
            onCheckedChange={(v) => set("isPrimary", !!v)}
            id="primary"
          />
          <Label htmlFor="primary" className="text-sm">
            Primary Contact
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
          <Checkbox
            checked={form.isDecisionMaker}
            onCheckedChange={(v) => set("isDecisionMaker", !!v)}
            id="dm"
          />
          <Label htmlFor="dm" className="text-sm">
            Decision Maker
          </Label>
        </div>
      </div>
    </InlineFormPanel>
  );
}

export function ContactsTab({
  accountId,
  contacts,
}: {
  accountId: number;
  contacts: Contact[];
}) {
  const [adding, setAdding] = useState(false);
  const canDelete = usePermission(CONTACT_WRITE);
  const deleteMutation = useDeleteContact();

  if (adding) {
    return (
      <ContactInlineForm
        accountId={accountId}
        onCancel={() => setAdding(false)}
        onSaved={() => setAdding(false)}
      />
    );
  }

  return (
    <SectionShell
      title="Contacts"
      action={
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Contact
        </Button>
      }
    >
      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add the people you deal with at this account."
        />
      ) : (
        <Table>
          <TableHeader className="text-white">
            <TableRow
              className="hover:bg-transparent border-none"
              style={TABLE_HEAD_STYLE}
            >
              <TableHead className={TH_CLASS}>Name</TableHead>
              <TableHead className={TH_CLASS}>Designation</TableHead>
              <TableHead className={TH_CLASS}>Email</TableHead>
              <TableHead className={TH_CLASS}>Phone</TableHead>
              <TableHead className={TH_CLASS}>Flags</TableHead>
              <TableHead className={`w-20 ${TH_CLASS}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow
                key={c.id}
                className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
              >
                <TableCell className="font-semibold text-slate-700 text-base py-1">
                  {c.name}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {c.designation || "—"}
                  {c.department ? ` · ${c.department}` : ""}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-base text-slate-900 py-1">
                  {c.phone || c.whatsapp ? (
                    <a
                      href={`tel:${c.phone || c.whatsapp}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.phone || c.whatsapp}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="space-x-1 text-base py-1">
                  {c.isPrimary && (
                    <Badge variant="outline" className="text-xs">
                      Primary
                    </Badge>
                  )}
                  {c.isDecisionMaker && (
                    <Badge variant="outline" className="text-xs">
                      Decision Maker
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-base py-1">
                  {canDelete && (
                    <DeleteConfirmDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className={CRM_DELETE_BTN_CLASS}
                          title="Delete contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      }
                      title="Delete this contact?"
                      description={`"${c.name}" will be moved to the CRM Recycle Bin.`}
                      onConfirm={async () => {
                        await deleteMutation.mutateAsync(c.id);
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionShell>
  );
}
