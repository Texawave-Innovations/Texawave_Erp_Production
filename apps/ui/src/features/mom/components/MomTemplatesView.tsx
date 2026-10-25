"use client";

import type { MomTemplate } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  type ActionMenuItem,
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  SearchInput,
  Select,
  StatusBadge,
  TableSkeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Archive,
  ArrowLeft,
  Copy,
  GitBranch,
  Pencil,
  Plus,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { errorMessage } from "@/features/projects/format";
import {
  useCreateMomTemplate,
  useCreateMomTemplateVersion,
  useDeleteMomTemplate,
  useDuplicateMomTemplate,
  useMomTemplates,
  usePublishMomTemplate,
  useUpdateMomTemplate,
} from "../hooks";
import { MOM_MANAGE_TEMPLATES, MOM_READ } from "../permissions";
import type { CreateMomTemplateFormValues } from "../schema";
import { MomTemplateForm } from "./MomTemplateForm";

function templateTone(
  status: MomTemplate["status"],
): "success" | "gray" | "brand" {
  if (status === "active") return "success";
  if (status === "archived") return "gray";
  return "brand";
}

const STATUS_LABEL: Record<MomTemplate["status"], string> = {
  active: "Published",
  draft: "Draft",
  archived: "Archived",
};

/** Legacy `mom/pages/MomTemplatesPage.tsx` — template library with
 * versioning: publish (locks a version), create next version, duplicate,
 * set default, archive, and delete drafts. */
export function MomTemplatesView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(MOM_READ);
  const canManage = usePermission(MOM_MANAGE_TEMPLATES);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<{
    kind: "archive" | "delete";
    template: MomTemplate;
  } | null>(null);

  const query = useMomTemplates();
  const createMutation = useCreateMomTemplate();
  const updateMutation = useUpdateMomTemplate();
  const deleteMutation = useDeleteMomTemplate();
  const publishMutation = usePublishMomTemplate();
  const duplicateMutation = useDuplicateMomTemplate();
  const versionMutation = useCreateMomTemplateVersion();

  const templates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (t) =>
        (!status || t.status === status) &&
        (!term ||
          t.name.toLowerCase().includes(term) ||
          (t.code ?? "").toLowerCase().includes(term) ||
          (t.category ?? "").toLowerCase().includes(term)),
    );
  }, [query.data, search, status]);

  async function act<T>(
    fn: () => Promise<T>,
    success: string,
    failure: string,
  ): Promise<T | undefined> {
    try {
      const result = await fn();
      toast({ title: success, variant: "success" });
      return result;
    } catch (err) {
      toast({
        title: failure,
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
      return undefined;
    }
  }

  async function handleCreate(values: CreateMomTemplateFormValues) {
    const created = await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({
      title: `Template "${created.name}" created as a draft`,
      variant: "success",
    });
    router.push(`/projects/mom/templates/${created.id}/builder`);
  }

  function actions(t: MomTemplate): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      {
        label:
          t.status === "draft" && canManage ? "Open Builder" : "View Template",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => router.push(`/projects/mom/templates/${t.id}/builder`),
      },
    ];
    if (!canManage) return items;
    if (t.status === "draft") {
      items.push({
        label: "Publish",
        icon: <Send className="h-4 w-4" />,
        onClick: () =>
          void act(
            () => publishMutation.mutateAsync(t.id),
            `"${t.name}" V${t.version} published`,
            "Could not publish",
          ),
      });
    } else {
      items.push({
        label: "Create Next Version",
        icon: <GitBranch className="h-4 w-4" />,
        onClick: () =>
          void act(
            () => versionMutation.mutateAsync(t.id),
            "New draft version created",
            "Could not create a version",
          ).then((created) => {
            if (created)
              router.push(`/projects/mom/templates/${created.id}/builder`);
          }),
      });
    }
    items.push({
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () =>
        void act(
          () => duplicateMutation.mutateAsync(t.id),
          `Duplicated "${t.name}"`,
          "Could not duplicate",
        ).then((created) => {
          if (created)
            router.push(`/projects/mom/templates/${created.id}/builder`);
        }),
    });
    if (t.status === "active" && !t.isDefault) {
      items.push({
        label: "Set as Default",
        icon: <Star className="h-4 w-4" />,
        onClick: () =>
          void act(
            () =>
              updateMutation.mutateAsync({
                id: t.id,
                input: { isDefault: true },
              }),
            `"${t.name}" is now the default template`,
            "Could not set the default",
          ),
      });
    }
    if (t.status !== "archived") {
      items.push({
        label: "Archive",
        icon: <Archive className="h-4 w-4" />,
        separator: true,
        onClick: () => setConfirm({ kind: "archive", template: t }),
      });
    }
    if (t.status === "draft") {
      items.push({
        label: "Delete Draft",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => setConfirm({ kind: "delete", template: t }),
      });
    }
    return items;
  }

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to MoM Templates">
        Ask an administrator for the <code>{MOM_READ}</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg sm:p-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/projects/mom"
            aria-label="Back to the MoM register"
            className="rounded-xl bg-white/20 p-2 hover:bg-white/30"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <span className="text-theme-xs font-bold uppercase tracking-wider text-cyan-100">
              Template Library
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Meeting Minutes Templates
            </h1>
            <p className="max-w-xl text-theme-sm text-sky-50/90">
              Versioned layouts for meeting records. Published versions are
              locked so issued minutes stay reproducible — create a new version
              to make changes.
            </p>
          </div>
        </div>
        {canManage ? (
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput
            aria-label="Search templates"
            placeholder="Search name, code, category..."
            value={search}
            onChangeValue={setSearch}
            clearable
            onClear={() => setSearch("")}
            className="sm:col-span-2"
          />
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
      </Card>

      {query.isPending ? (
        <TableSkeleton rowsCount={4} columnsCount={6} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to MoM Templates"
          >
            Ask an administrator for the <code>{MOM_READ}</code> permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState
            title={
              query.data.length === 0
                ? "No templates yet"
                : "No templates match"
            }
            description={
              query.data.length === 0
                ? canManage
                  ? "Create a template — it starts from the standard meeting layout."
                  : "No MoM templates have been created yet. Meetings use the standard layout."
                : "Try a different search or status."
            }
          />
        </Card>
      ) : (
        <DataTable<MomTemplate>
          caption="MoM templates"
          columns={[
            {
              header: "Code",
              cell: (t) => (
                <span className="font-semibold">{t.code ?? "—"}</span>
              ),
            },
            {
              header: "Template",
              cell: (t) => (
                <div className="min-w-0">
                  <Link
                    href={`/projects/mom/templates/${t.id}/builder`}
                    className="font-semibold text-gray-900 hover:text-brand-600 hover:underline dark:text-white/90"
                  >
                    {t.name}
                  </Link>
                  {t.isDefault ? (
                    <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-theme-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                      Default
                    </span>
                  ) : null}
                  {t.description ? (
                    <p className="line-clamp-1 text-theme-xs text-gray-500 dark:text-gray-400">
                      {t.description}
                    </p>
                  ) : null}
                </div>
              ),
            },
            { header: "Category", cell: (t) => t.category ?? "—" },
            {
              header: "Version",
              align: "center",
              cell: (t) => `V${t.version}`,
            },
            {
              header: "Sections",
              align: "center",
              cell: (t) => t.sectionsJson.length,
            },
            {
              header: "Status",
              align: "center",
              cell: (t) => (
                <StatusBadge
                  label={STATUS_LABEL[t.status]}
                  colorToken={templateTone(t.status)}
                />
              ),
            },
            {
              header: "Actions",
              headerClassName: "sr-only",
              align: "right",
              cell: (t) => (
                <ActionMenu
                  ariaLabel={`Actions for ${t.name}`}
                  items={actions(t)}
                />
              ),
            },
          ]}
          rows={templates}
          getRowKey={(t) => String(t.id)}
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New MoM Template"
      >
        <MomTemplateForm
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create & Open Builder"
        />
      </Dialog>

      <ConfirmDialog
        open={confirm?.kind === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const t = confirm.template;
          await act(
            () =>
              updateMutation.mutateAsync({
                id: t.id,
                input: { status: "archived", isDefault: false },
              }),
            `"${t.name}" archived`,
            "Could not archive",
          );
          setConfirm(null);
        }}
        title="Archive template?"
        description="Archived templates can't be picked for new meetings. Minutes already issued from it are unaffected."
        itemName={confirm?.template.name}
        confirmText="Archive"
        variant="destructive"
        loading={updateMutation.isPending}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const t = confirm.template;
          await act(
            () => deleteMutation.mutateAsync(t.id),
            `"${t.name}" deleted`,
            "Could not delete",
          );
          setConfirm(null);
        }}
        title="Delete draft template?"
        itemName={confirm?.template.name}
        confirmText="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
