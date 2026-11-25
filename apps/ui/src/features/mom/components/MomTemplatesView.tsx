"use client";

import type { MomTemplate } from "@texawave-erp/api-types";
import {
  ApiError,
  type MessageKey,
  type MessageParams,
} from "@texawave-erp/core";
import {
  PageHeader,
  Button,
  ActionMenu,
  type ActionMenuItem,
  Alert,
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
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
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
  const { notify, notifyFailure } = useNotify();
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
    success: MessageKey,
    failure: MessageKey,
    params?: MessageParams,
  ): Promise<T | undefined> {
    try {
      const result = await fn();
      notify(success, params);
      return result;
    } catch (err) {
      notifyFailure(err, failure, params);
      return undefined;
    }
  }

  async function handleCreate(values: CreateMomTemplateFormValues) {
    const created = await createMutation.mutateAsync(values);
    setCreateOpen(false);
    notify("mom.template.created", { name: created.name });
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
            "mom.template.published",
            "mom.template.publishFailed",
            { name: t.name, version: t.version },
          ),
      });
    } else {
      items.push({
        label: "Create Next Version",
        icon: <GitBranch className="h-4 w-4" />,
        onClick: () =>
          void act(
            () => versionMutation.mutateAsync(t.id),
            "mom.template.versionCreated",
            "mom.template.versionFailed",
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
          "mom.template.duplicatedNamed",
          "mom.template.duplicateFailed",
          { name: t.name },
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
            "mom.template.defaultSet",
            "mom.template.defaultFailed",
            { name: t.name },
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
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to MoM Templates"
      >
        Ask an administrator for the <code>{MOM_READ}</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="banner"
        icon={
          <Link
            href="/projects/mom"
            aria-label="Back to the MoM register"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm transition-colors hover:bg-brand-50 dark:bg-[#161B26] dark:text-sky-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
        title="Meeting Minutes Templates"
        description="Versioned layouts for meeting records. Published versions are locked so issued minutes stay reproducible — create a new version to make changes."
        action={
          canManage ? (
            <Button variant="glass" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          ) : null
        }
      />

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
            dismissible
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
            "mom.template.archived",
            "mom.template.archiveFailed",
            { name: t.name },
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
            "mom.template.deleted",
            "mom.template.deleteFailed",
            { name: t.name },
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
