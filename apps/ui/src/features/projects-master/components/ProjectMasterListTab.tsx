"use client";

import type { Project } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "../hooks";
import { PROJECT_READ, PROJECT_WRITE } from "../permissions";
import type { CreateProjectFormValues } from "../schema";
import { ProjectForm } from "./ProjectForm";

const PAGE_SIZE = 10;

/** Tab 1: Project Master — the project type/category registry (ME, SW, EC)
 * that Project Code Master slots into its format. Mirrors
 * apps/ui/src/features/_reference/tags/components/TagsView.tsx's screen
 * states. */
export function ProjectMasterListTab() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const { notify } = useNotify();

  const canRead = usePermission(PROJECT_READ);
  const canWrite = usePermission(PROJECT_WRITE);

  const query = useProjects({ page, limit: PAGE_SIZE });
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  if (!canRead) {
    return (
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to Project Master"
      >
        Ask an administrator for the <code>{PROJECT_READ}</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          dismissible
          variant="warning"
          title="You don't have access to Project Master"
        >
          Ask an administrator for the <code>{PROJECT_READ}</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const projects = query.data.data;
  const meta = query.data.meta;

  async function handleCreate(values: CreateProjectFormValues) {
    await createMutation.mutateAsync(values);
    setCreateOpen(false);
    notify("projects.master.created");
  }

  async function handleUpdate(values: CreateProjectFormValues) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input: values });
    setEditing(null);
    notify("projects.master.updated");
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(project.id);
      notify("projects.master.deleted", { name: project.name });
    } catch {
      notify("projects.master.deleteFailed", { name: project.name });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Projects Master List
        </h2>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>Add New Project</Button>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects yet"
            description={
              canWrite
                ? "Add your first project type to see it here."
                : "No project types have been added yet."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<Project>
            caption="Projects Master list"
            columns={[
              { header: "Project Code", cell: (p) => p.code },
              { header: "Project Name", cell: (p) => p.name },
              {
                header: "Description / Scope",
                cell: (p) => p.description ?? "—",
              },
              {
                header: "Actions",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (p) =>
                  canWrite ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(p)}
                        aria-label={`Edit ${p.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(p)}
                        aria-label={`Delete ${p.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
            rows={projects}
            getRowKey={(p) => String(p.id)}
          />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New Project"
      >
        <ProjectForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Add"
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Project"
      >
        {editing ? (
          <ProjectForm
            initialValues={{
              code: editing.code,
              name: editing.name,
              description: editing.description ?? undefined,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>
    </div>
  );
}
