"use client";

import type { ProposalTemplate } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { ArrowLeft, CheckCircle2, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useProjects } from "@/features/projects/hooks";
import { errorMessage, todayInput } from "@/features/projects/format";
import { useCreateProposalDocument, useProposalTemplates } from "../hooks";
import { PROPOSALS_WRITE } from "../permissions";
import { createProposalDocumentSchema } from "../schema";

function plusDays(days: number): string {
  const d = new Date(`${todayInput()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Legacy `proposals/CreateProposal.tsx` — pick a published template (its
 * structure is frozen into the proposal on creation), link a project (which
 * pre-fills the client), and set the proposal / follow-up dates. The
 * proposal number is issued by the server from Proposal Settings. */
export function CreateProposalView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const canWrite = usePermission(PROPOSALS_WRITE);
  const templatesQuery = useProposalTemplates();
  const projectsQuery = useProjects({ limit: 100 });
  const createMutation = useCreateProposalDocument();

  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).filter(
        (t) => t.status === "active" && t.isCurrent,
      ),
    [templatesQuery.data],
  );
  const projects = projectsQuery.data?.data ?? [];

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [title, setTitle] = useState("Client Proposal & Statement of Work");
  const [projectId, setProjectId] = useState(
    searchParams.get("projectId") ?? "",
  );
  const [clientName, setClientName] = useState("");
  const [proposalDate, setProposalDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const effectiveTemplateId =
    templateId ??
    templates.find((t) => t.isDefault)?.id ??
    templates[0]?.id ??
    null;
  const selected = templates.find((t) => t.id === effectiveTemplateId);

  function selectProject(id: string) {
    setProjectId(id);
    const project = projects.find((p) => String(p.id) === id);
    const client = project?.customerName ?? project?.customer?.name;
    if (client) setClientName(client);
  }

  async function submit() {
    const result = createProposalDocumentSchema.safeParse({
      title,
      projectId: projectId ? Number(projectId) : undefined,
      clientName: clientName || undefined,
      templateId: effectiveTemplateId ?? undefined,
      proposalDate: proposalDate || undefined,
      dueDate: dueDate || undefined,
    });
    const fieldErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
    }
    if (!clientName.trim()) fieldErrors.clientName = "Client name is required";
    if (dueDate && proposalDate && dueDate < proposalDate) {
      fieldErrors.dueDate = "Follow-up date cannot be before the proposal date";
    }
    setErrors(fieldErrors);
    if (!result.success || Object.keys(fieldErrors).length > 0) return;
    try {
      const created = await createMutation.mutateAsync(result.data);
      toast({
        title: `Proposal ${created.proposalNumber} created`,
        variant: "success",
      });
      router.push(`/projects/proposals/${created.id}`);
    } catch (err) {
      toast({
        title: "Could not create the proposal",
        description: errorMessage(err, "Your entries are kept — try again."),
        variant: "error",
      });
    }
  }

  if (!canWrite) {
    return (
      <Alert variant="warning" title="You can't create proposals">
        Ask an administrator for the <code>{PROPOSALS_WRITE}</code> permission.
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg">
        <Link
          href="/projects/proposals"
          aria-label="Back to proposals"
          className="rounded-xl bg-white/20 p-2 hover:bg-white/30"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-theme-xs font-bold uppercase tracking-wider text-cyan-100">
            New Document
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Create Client Proposal
          </h1>
          <p className="text-theme-sm text-sky-50/90">
            The proposal number is assigned automatically from your Proposal
            Settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            1. Choose a Template
          </h2>
          {templatesQuery.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <Alert variant="info" title="No published templates">
              The proposal will be created without structured sections.{" "}
              <Link
                href="/projects/proposals/templates"
                className="font-semibold underline"
              >
                Publish a template
              </Link>{" "}
              to get guided sections.
            </Alert>
          ) : (
            <div
              role="radiogroup"
              aria-label="Proposal template"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  selected={t.id === effectiveTemplateId}
                  onSelect={() => setTemplateId(t.id)}
                />
              ))}
            </div>
          )}
          {selected ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-theme-xs text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              An exact copy of &quot;{selected.title}&quot; V{selected.version}{" "}
              — sections, table columns and rules — is locked into this
              proposal. Later template edits or new versions will not change it.
            </p>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            2. Proposal Details
          </h2>
          <div className="flex flex-col gap-4">
            <FormField label="Proposal Title" required error={errors.title}>
              {(fp) => (
                <Input
                  {...fp}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
            </FormField>
            <FormField
              label="Linked Project"
              hint="Selecting a project fills in its client."
            >
              {(fp) => (
                <Select
                  {...fp}
                  value={projectId}
                  onChange={(e) => selectProject(e.target.value)}
                >
                  <option value="">
                    {projectsQuery.isPending
                      ? "Loading projects..."
                      : "Independent / no project"}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Client Name" required error={errors.clientName}>
              {(fp) => (
                <Input
                  {...fp}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Proposal Date" error={errors.proposalDate}>
                {(fp) => (
                  <Input
                    {...fp}
                    type="date"
                    value={proposalDate}
                    onChange={(e) => setProposalDate(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Follow-up Due" error={errors.dueDate}>
                {(fp) => (
                  <Input
                    {...fp}
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => router.push("/projects/proposals")}
              >
                Cancel
              </Button>
              <Button
                loading={createMutation.isPending}
                onClick={() => void submit()}
              >
                <FileText className="h-4 w-4" />
                Create & Open Editor
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ProposalTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        selected
          ? "flex flex-col gap-1 rounded-xl border-2 border-brand-500 bg-brand-50/60 p-3 text-left dark:bg-brand-950/40"
          : "flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
      }
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white/90">
          {template.title}
        </span>
        {selected ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
        ) : null}
      </span>
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
        {template.code ?? "—"} · V{template.version} ·{" "}
        {template.schemaJson.length} sections
        {template.isDefault ? " · default" : ""}
      </span>
      {template.department ? (
        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
          {template.department}
        </span>
      ) : null}
      {template.description ? (
        <span className="line-clamp-2 text-theme-xs text-gray-600 dark:text-gray-300">
          {template.description}
        </span>
      ) : null}
    </button>
  );
}
