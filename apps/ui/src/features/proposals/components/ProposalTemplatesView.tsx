"use client";

import type { ProposalTemplate } from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
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
  useToast,
} from "@texawave-erp/ui-kit";
import {
  Archive,
  ArrowLeft,
  Copy,
  GitBranch,
  Layers,
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
import { errorMessage, formatDate } from "@/features/projects/format";
import {
  useCreateProposalTemplate,
  useCreateProposalTemplateVersion,
  useDeleteProposalTemplate,
  useDuplicateProposalTemplate,
  useProposalTemplates,
  usePublishProposalTemplate,
  useUpdateProposalTemplate,
} from "../hooks";
import { PROPOSALS_MANAGE_TEMPLATES, PROPOSALS_READ } from "../permissions";
import type { CreateProposalTemplateFormValues } from "../schema";
import { ProposalTemplateForm } from "./ProposalTemplateForm";

const STATUS_LABEL: Record<ProposalTemplate["status"], string> = {
  active: "Published",
  draft: "Draft",
  archived: "Archived",
};

function tone(t: ProposalTemplate): "success" | "gray" | "brand" | "warning" {
  if (t.status === "active") return t.isCurrent ? "success" : "warning";
  if (t.status === "archived") return "gray";
  return "brand";
}

/** Legacy `proposals/ProposalTemplates.tsx` (+ `CreateTemplateModal.tsx`) —
 * versioned template library: publish (locks a version and retires the one
 * it replaced), create next version, duplicate, set default, archive, and
 * delete drafts. */
export function ProposalTemplatesView() {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(PROPOSALS_READ);
  const canManage = usePermission(PROPOSALS_MANAGE_TEMPLATES);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<{
    kind: "archive" | "delete";
    template: ProposalTemplate;
  } | null>(null);

  const query = useProposalTemplates();
  const createMutation = useCreateProposalTemplate();
  const updateMutation = useUpdateProposalTemplate();
  const deleteMutation = useDeleteProposalTemplate();
  const publishMutation = usePublishProposalTemplate();
  const duplicateMutation = useDuplicateProposalTemplate();
  const versionMutation = useCreateProposalTemplateVersion();

  const templates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (t) =>
        (!status || t.status === status) &&
        (!term ||
          t.title.toLowerCase().includes(term) ||
          t.name.toLowerCase().includes(term) ||
          (t.code ?? "").toLowerCase().includes(term) ||
          (t.department ?? "").toLowerCase().includes(term)),
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

  function open(id: number) {
    router.push(`/projects/proposals/templates/${id}/builder`);
  }

  function actions(t: ProposalTemplate): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      {
        label:
          t.status === "draft" && canManage ? "Open Builder" : "View Template",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => open(t.id),
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
            `"${t.title}" V${t.version} published`,
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
          ).then((c) => {
            if (c) open(c.id);
          }),
      });
    }
    items.push({
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () =>
        void act(
          () => duplicateMutation.mutateAsync(t.id),
          `Duplicated "${t.title}"`,
          "Could not duplicate",
        ).then((c) => {
          if (c) open(c.id);
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
            `"${t.title}" is now the default template`,
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

  async function handleCreate(values: CreateProposalTemplateFormValues) {
    const created = await createMutation.mutateAsync(values);
    setCreateOpen(false);
    toast({
      title: `Template "${created.title}" created as a draft`,
      variant: "success",
    });
    open(created.id);
  }

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Proposal Templates"
      >
        Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg sm:p-8 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/projects/proposals"
            aria-label="Back to proposals"
            className="rounded-xl bg-white/20 p-2 hover:bg-white/30"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <span className="text-theme-xs font-bold uppercase tracking-wider text-cyan-100">
              Template Library
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Proposal Templates
            </h1>
            <p className="max-w-xl text-theme-sm text-sky-50/90">
              Published versions are locked; issued proposals keep the exact
              snapshot they were created from.
            </p>
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-md transition-all hover:bg-cyan-50 hover:shadow-lg active:scale-95 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Template
          </button>
        ) : null}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput
            aria-label="Search templates"
            placeholder="Search title, code, department..."
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
        <TableSkeleton rowsCount={4} columnsCount={7} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to Proposal Templates"
          >
            Ask an administrator for the <code>{PROPOSALS_READ}</code>{" "}
            permission.
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
                  ? "Create a template to give proposals a consistent structure."
                  : "No proposal templates have been created yet."
                : "Try a different search or status."
            }
          />
        </Card>
      ) : (
        <DataTable<ProposalTemplate>
          caption="Proposal templates"
          columns={[
            {
              header: "Template",
              cell: (t) => (
                <div className="min-w-0">
                  <Link
                    href={`/projects/proposals/templates/${t.id}/builder`}
                    className="font-semibold text-gray-900 hover:text-brand-600 hover:underline dark:text-white/90"
                  >
                    {t.title}
                  </Link>
                  {t.isDefault ? (
                    <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-theme-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                      Default
                    </span>
                  ) : null}
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t.name}
                  </p>
                </div>
              ),
            },
            {
              header: "Code",
              cell: (t) => (
                <span className="font-semibold">{t.code ?? "—"}</span>
              ),
            },
            {
              header: "Version",
              align: "center",
              cell: (t) =>
                `V${t.version}${t.status === "active" && !t.isCurrent ? " (superseded)" : ""}`,
            },
            {
              header: "Sections",
              align: "center",
              cell: (t) => t.schemaJson.length,
            },
            {
              header: "Department / Category",
              cell: (t) =>
                [t.department, t.category].filter(Boolean).join(" · ") || "—",
            },
            {
              header: "Created By",
              cell: (t) => (
                <div>
                  <p>{t.createdByName ?? "—"}</p>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Updated {formatDate(t.updatedAt)}
                  </p>
                </div>
              ),
            },
            {
              header: "Status",
              align: "center",
              cell: (t) => (
                <StatusBadge
                  label={STATUS_LABEL[t.status]}
                  colorToken={tone(t)}
                />
              ),
            },
            {
              header: "Actions",
              headerClassName: "sr-only",
              align: "right",
              cell: (t) => (
                <ActionMenu
                  ariaLabel={`Actions for ${t.title}`}
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
        title={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
              <Layers className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="dialog-title"
                className="truncate text-theme-sm font-semibold tracking-tight text-gray-900 dark:text-white/90"
              >
                Create Proposal Template
              </h2>
              <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                Setup template metadata. You will configure sections and table
                columns next.
              </p>
            </div>
          </div>
        }
        size="5xl"
        className="h-fit"
      >
        <ProposalTemplateForm
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
            `"${t.title}" archived`,
            "Could not archive",
          );
          setConfirm(null);
        }}
        title="Archive template?"
        description="Archived templates can't be used for new proposals. Proposals already issued from it are unaffected."
        itemName={confirm?.template.title}
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
            `"${t.title}" deleted`,
            "Could not delete",
          );
          setConfirm(null);
        }}
        title="Delete draft template?"
        itemName={confirm?.template.title}
        confirmText="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
