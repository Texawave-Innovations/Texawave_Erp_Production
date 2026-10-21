"use client";

import type { QualityTemplate } from "@texawave-erp/api-types";
import {
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
} from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
interface CheckpointDraft {
  checkpointId?: string;
  name: string;
  description: string;
  required: boolean;
  expectedValue: string;
  unit: string;
}
const blankCheckpoint = (): CheckpointDraft => ({
  name: "",
  description: "",
  required: true,
  expectedValue: "",
  unit: "",
});

/** Legacy `ScmQualityTemplates`: reusable inspection checkpoint templates. */
export function TemplatesView() {
  const c = useListControls();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QualityTemplate | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.quality.write");
  const deletingRowRemove = useDeleteTemplate();
  const [deletingRow, setDeletingRow] = useState<QualityTemplate | null>(null);
  const query = useTemplates({ page: c.page, limit: c.pageSize, q: c.q });

  return (
    <ScmListView<QualityTemplate>
      title="QC Templates"
      description="Reusable checkpoint sets attached to an inspection when it's created."
      icon={ClipboardCheck}
      noun="templates"
      readPermission="scm.quality.read"
      query={query}
      page={c.page}
      pageSize={c.pageSize}
      onPageChange={c.setPage}
      getRowKey={(r) => String(r.id)}
      onRowClick={(r) => {
        if (canWrite) {
          setEditing(r);
          setFormOpen(true);
        }
      }}
      actions={
        canWrite ? (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        ) : null
      }
      search={{
        value: c.search,
        onChange: c.setSearch,
        placeholder: "Search by code or name...",
      }}
      hasActiveFilters={Boolean(c.search)}
      onResetFilters={() => c.setSearch("")}
      emptyTitle="No templates yet"
      emptyDescription="Add a template to attach checkpoints to inspections."
      columns={[
        {
          header: "Code",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.templateCode}</span>
          ),
        },
        { header: "Name", cell: (r) => r.name },
        {
          header: "Type",
          cell: (r) => INSPECTION_TYPE_LABEL[r.inspectionType],
        },
        {
          header: "Checkpoints",
          align: "right",
          cell: (r) => r.checkpoints.length,
        },
        {
          header: "Status",
          cell: (r) => (
            <StatusBadge
              label={r.active ? "Active" : "Inactive"}
              colorToken={r.active ? "success" : "gray"}
            />
          ),
        },
        {
          header: "",
          headerClassName: "text-right",
          className: "text-right",
          cell: (r) =>
            canWrite ? (
              <div
                className="flex justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <ScmDeleteButton
                  label="Delete template"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<QualityTemplate>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete template?"
        describe={(r) =>
          `Delete template ${r.templateCode} (${r.name})? This cannot be undone. Blocked automatically if an inspection was raised from it.`
        }
        confirmText="Delete template"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Template deleted"
        errorFallback="Failed to delete template"
      />
      <TemplateForm
        open={formOpen}
        template={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={(label) => {
          toast({ title: label, variant: "success" });
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </ScmListView>
  );
}

function TemplateForm({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: QualityTemplate | null;
  onClose: () => void;
  onSaved: (label: string) => void;
}) {
  return (
    <ScmPanel
      open={open}
      onClose={onClose}
      title={template ? `Edit ${template.templateCode}` : "New QC Template"}
      size="2xl"
      className="sm:max-w-3xl"
    >
      {open ? (
        <Body
          key={template?.id ?? "new"}
          template={template}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </ScmPanel>
  );
}

function Body({
  template,
  onClose,
  onSaved,
}: {
  template: QualityTemplate | null;
  onClose: () => void;
  onSaved: (label: string) => void;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [templateCode, setTemplateCode] = useState(
    template?.templateCode ?? "",
  );
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [inspectionType, setInspectionType] = useState(
    template?.inspectionType ?? INSPECTION_TYPES[0],
  );
  const [active, setActive] = useState(template?.active ?? true);
  const [checkpoints, setCheckpoints] = useState<CheckpointDraft[]>(
    template?.checkpoints.map((c) => ({
      checkpointId: c.checkpointId,
      name: c.name,
      description: c.description ?? "",
      required: c.required,
      expectedValue: c.expectedValue ?? "",
      unit: c.unit ?? "",
    })) ?? [blankCheckpoint()],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(idx: number, next: Partial<CheckpointDraft>) {
    setCheckpoints((cps) =>
      cps.map((c, i) => (i === idx ? { ...c, ...next } : c)),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const filled = checkpoints.filter((c) => c.name.trim());
    if (!template && !templateCode.trim())
      return setError("Template code is required");
    if (!name.trim()) return setError("Name is required");
    if (filled.length === 0) return setError("Add at least one checkpoint");
    setError(null);
    setBusy(true);
    const checkpointInput = filled.map((c) => ({
      ...(c.checkpointId ? { checkpointId: c.checkpointId } : {}),
      name: c.name.trim(),
      description: c.description.trim() || undefined,
      required: c.required,
      expectedValue: c.expectedValue.trim() || undefined,
      unit: c.unit.trim() || undefined,
    }));
    try {
      if (template) {
        await update.mutateAsync({
          id: template.id,
          input: {
            name,
            description: description || undefined,
            active,
            checkpoints: checkpointInput,
          },
        });
        onSaved("Template updated");
      } else {
        const created = await create.mutateAsync({
          templateCode,
          name,
          description: description || undefined,
          inspectionType,
          checkpoints: checkpointInput,
        });
        onSaved(`${created.templateCode} created`);
      }
    } catch (err) {
      setError(errorText(err, "Failed to save template"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          aria-label="Template code"
          placeholder="Template code"
          className="font-mono uppercase"
          value={templateCode}
          disabled={Boolean(template)}
          onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
        />
        <Input
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          aria-label="Inspection type"
          value={inspectionType}
          disabled={Boolean(template)}
          onChange={(e) =>
            setInspectionType(
              e.target.value as (typeof INSPECTION_TYPES)[number],
            )
          }
        >
          {INSPECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {INSPECTION_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        {template ? (
          <Select
            aria-label="Status"
            value={active ? "true" : "false"}
            onChange={(e) => setActive(e.target.value === "true")}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        ) : null}
      </div>
      <Input
        aria-label="Description"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        {checkpoints.map((cp, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_6rem_auto_auto]"
          >
            <Input
              aria-label={`Checkpoint ${idx + 1} name`}
              placeholder="Checkpoint name"
              value={cp.name}
              onChange={(e) => patch(idx, { name: e.target.value })}
            />
            <Input
              aria-label={`Checkpoint ${idx + 1} expected value`}
              placeholder="Expected value (optional)"
              value={cp.expectedValue}
              onChange={(e) => patch(idx, { expectedValue: e.target.value })}
            />
            <Input
              aria-label={`Checkpoint ${idx + 1} unit`}
              placeholder="Unit"
              value={cp.unit}
              onChange={(e) => patch(idx, { unit: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-theme-xs whitespace-nowrap">
              <Checkbox
                aria-label={`Checkpoint ${idx + 1} required`}
                checked={cp.required}
                onChange={(e) => patch(idx, { required: e.target.checked })}
              />
              Required
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove checkpoint ${idx + 1}`}
              disabled={checkpoints.length === 1}
              onClick={() =>
                setCheckpoints((cps) => cps.filter((_, i) => i !== idx))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() => setCheckpoints((cps) => [...cps, blankCheckpoint()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Checkpoint
          </Button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {template ? "Save Changes" : "Create Template"}
        </Button>
      </div>
    </form>
  );
}
