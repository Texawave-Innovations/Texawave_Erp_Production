"use client";

import type { QualityDefect, UpdateDefectInput } from "@texawave-erp/api-types";
import { Button, StatusBadge, useToast } from "@texawave-erp/ui-kit";
import { BadgeAlert, Plus } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useMasterListItems } from "../../master-list-items/hooks";
import { formatStatusLabel } from "../../shared/format";
import { ScmFormDialog } from "../../shared/ScmFormDialog";
import { ScmDeleteButton, ScmDeleteDialog } from "../../shared/ScmDeleteDialog";
import { ScmListView } from "../../shared/ScmListView";
import { errorText, useListControls } from "../../shared/use-list-controls";
import {
  useCreateDefect,
  useDefects,
  useDeleteDefect,
  useUpdateDefect,
} from "../hooks";

const SEVERITY_TONE: Record<
  string,
  "success" | "warning" | "error" | "brand" | "gray"
> = {
  LOW: "gray",
  MEDIUM: "brand",
  HIGH: "warning",
  CRITICAL: "error",
};

/** Legacy `ScmQualityDefects`: defect master, never hard-deleted. */
export function DefectsView() {
  const c = useListControls();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QualityDefect | null>(null);
  const { toast } = useToast();
  const canWrite = usePermission("scm.quality.write");
  const deletingRowRemove = useDeleteDefect();
  const [deletingRow, setDeletingRow] = useState<QualityDefect | null>(null);
  const create = useCreateDefect();
  const update = useUpdateDefect();
  const query = useDefects({ page: c.page, limit: c.pageSize, q: c.q });
  const categories = useMasterListItems({
    category: "quality_defect_category",
    page: 1,
    limit: 100,
  });
  const categoryOptions = categories.data?.data ?? [];
  const severities = useMasterListItems({
    category: "quality_defect_severity",
    page: 1,
    limit: 100,
  });
  const severityOptions = severities.data?.data ?? [];

  return (
    <ScmListView<QualityDefect>
      title="Defects"
      description="Defect codes used across QC inspections — categorized and rated by severity."
      icon={BadgeAlert}
      noun="defects"
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
            Add Defect
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
      emptyTitle="No defects yet"
      emptyDescription="Add a defect code to use on QC inspections."
      columns={[
        {
          header: "Code",
          cell: (r) => (
            <span className="font-mono text-theme-xs">{r.defectCode}</span>
          ),
        },
        { header: "Name", cell: (r) => r.name },
        { header: "Category", cell: (r) => formatStatusLabel(r.category) },
        {
          header: "Severity",
          cell: (r) => (
            <StatusBadge
              label={r.severity}
              colorToken={SEVERITY_TONE[r.severity] ?? "gray"}
            />
          ),
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
                  label="Delete defect"
                  onClick={() => setDeletingRow(r)}
                />
              </div>
            ) : null,
        },
      ]}
    >
      <ScmDeleteDialog<QualityDefect>
        target={deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Delete defect?"
        describe={(r) =>
          `Delete defect ${r.defectCode} (${r.name})? This cannot be undone. Blocked automatically if existing inspection or quarantine records reference it.`
        }
        confirmText="Delete defect"
        run={(r) => deletingRowRemove.mutateAsync(r.id)}
        successMessage="Defect deleted"
        errorFallback="Failed to delete defect"
      />
      <ScmFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.defectCode}` : "Add Defect"}
        submitLabel={editing ? "Save Changes" : "Add Defect"}
        initialValues={
          editing
            ? {
                defectCode: editing.defectCode,
                name: editing.name,
                description: editing.description ?? "",
                category: editing.category,
                severity: editing.severity,
                active: editing.active ? "true" : "false",
              }
            : {}
        }
        fields={[
          {
            name: "defectCode",
            label: "Defect code",
            type: "text",
            required: !editing,
            upper: true,
            mono: true,
            visibleWhen: () => !editing,
          },
          { name: "name", label: "Name", type: "text", required: true },
          {
            name: "category",
            label: "Category",
            type: "select",
            required: true,
            options: categoryOptions.map((v) => ({
              value: v.value,
              label: formatStatusLabel(v.value),
            })),
          },
          {
            name: "severity",
            label: "Severity",
            type: "select",
            required: true,
            options: severityOptions.map((v) => ({
              value: v.value,
              label: v.value,
            })),
          },
          ...(editing
            ? ([
                {
                  name: "active",
                  label: "Status",
                  type: "select" as const,
                  options: [
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ],
                },
              ] as const)
            : []),
          {
            name: "description",
            label: "Description",
            type: "textarea",
            span: 2,
          },
        ]}
        onSubmit={async (v) => {
          try {
            if (editing) {
              const input: UpdateDefectInput = {
                name: v.name as string,
                description: (v.description as string) || undefined,
                category: v.category as UpdateDefectInput["category"],
                severity: v.severity as UpdateDefectInput["severity"],
                active: v.active === "true",
              };
              await update.mutateAsync({ id: editing.id, input });
            } else {
              await create.mutateAsync({
                defectCode: v.defectCode as string,
                name: v.name as string,
                description: (v.description as string) || undefined,
                category: v.category as string,
                severity: v.severity as string,
              });
            }
          } catch (err) {
            throw new Error(errorText(err, "Failed to save defect"));
          }
          toast({
            title: editing ? "Defect updated" : "Defect added",
            variant: "success",
          });
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </ScmListView>
  );
}
