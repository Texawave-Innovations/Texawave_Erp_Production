"use client";

import type {
  ProposalSectionConfig,
  ProposalTemplate,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ArrowLeft, Copy, GitBranch, Lock, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { errorMessage, todayInput } from "@/features/projects/format";
import {
  useCreateProposalTemplateVersion,
  useDuplicateProposalTemplate,
  useProposalSettings,
  useProposalTemplate,
  usePublishProposalTemplate,
  useUpdateProposalTemplate,
} from "../hooks";
import { PROPOSALS_MANAGE_TEMPLATES, PROPOSALS_READ } from "../permissions";
import { ProposalDocumentSheet } from "./ProposalDocumentSheet";
import { SectionBuilder } from "./SectionBuilder";

export interface ProposalTemplateBuilderViewProps {
  templateId: number;
}

/** Legacy `TemplateBuilder.tsx` + `SectionConfigDrawer.tsx` +
 * `TemplateLivePreview.tsx` — template metadata and the section schema
 * editor on the left, a live document preview on the right. Published or
 * archived versions are read-only; changes go into a new version. */
export function ProposalTemplateBuilderView({
  templateId,
}: ProposalTemplateBuilderViewProps) {
  const canRead = usePermission(PROPOSALS_READ);
  const query = useProposalTemplate(templateId);

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
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to Proposal Templates"
        >
          Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Alert variant="warning" title="Template not found">
          It may have been deleted.{" "}
          <Link href="/projects/proposals/templates">Back to templates</Link>
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  return (
    <Builder
      key={`${query.data.id}-${query.data.updatedAt}`}
      template={query.data}
    />
  );
}

function Builder({ template }: { template: ProposalTemplate }) {
  const router = useRouter();
  const { toast } = useToast();
  const canManage = usePermission(PROPOSALS_MANAGE_TEMPLATES);
  const settings = useProposalSettings();
  const updateMutation = useUpdateProposalTemplate();
  const publishMutation = usePublishProposalTemplate();
  const versionMutation = useCreateProposalTemplateVersion();
  const duplicateMutation = useDuplicateProposalTemplate();

  const locked = template.status !== "draft";
  const readOnly = locked || !canManage;

  const [title, setTitle] = useState(template.title);
  const [name, setName] = useState(template.name);
  const [code, setCode] = useState(template.code ?? "");
  const [department, setDepartment] = useState(template.department ?? "");
  const [category, setCategory] = useState(template.category ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const [sections, setSections] = useState<ProposalSectionConfig[]>(
    template.schemaJson,
  );
  const [errors, setErrors] = useState<{ title?: string; name?: string }>({});

  async function save(): Promise<boolean> {
    const next: typeof errors = {};
    if (title.trim().length < 2) next.title = "Document title is required.";
    if (name.trim().length < 2) next.name = "Template name is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        input: {
          title: title.trim(),
          name: name.trim(),
          code: code.trim() || undefined,
          department: department.trim() || undefined,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          schemaJson: sections,
        },
      });
      return true;
    } catch (err) {
      toast({
        title: "Could not save the template",
        description: errorMessage(err, ""),
        variant: "error",
      });
      return false;
    }
  }

  async function handlePublish() {
    if (sections.length === 0) {
      toast({
        title: "Add at least one section before publishing",
        variant: "warning",
      });
      return;
    }
    if (!(await save())) return;
    try {
      await publishMutation.mutateAsync(template.id);
      toast({
        title: `V${template.version} published`,
        description: "This version is now locked.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Could not publish",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  async function navigateTo(
    fn: () => Promise<ProposalTemplate>,
    success: string,
    failure: string,
  ) {
    try {
      const created = await fn();
      toast({ title: success, variant: "success" });
      router.push(`/projects/proposals/templates/${created.id}/builder`);
    } catch (err) {
      toast({
        title: failure,
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects/proposals/templates"
            className="flex items-center gap-1 text-theme-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Templates
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white/90">
            {template.title}
          </h1>
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
            V{template.version}
          </span>
          <StatusBadge
            label={
              template.status === "active"
                ? template.isCurrent
                  ? "Published"
                  : "Superseded"
                : template.status === "draft"
                  ? "Draft"
                  : "Archived"
            }
            colorToken={
              template.status === "active"
                ? "success"
                : template.status === "draft"
                  ? "brand"
                  : "gray"
            }
          />
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={duplicateMutation.isPending}
              onClick={() =>
                void navigateTo(
                  () => duplicateMutation.mutateAsync(template.id),
                  "Template duplicated",
                  "Could not duplicate",
                )
              }
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            {locked ? (
              <Button
                size="sm"
                loading={versionMutation.isPending}
                onClick={() =>
                  void navigateTo(
                    () => versionMutation.mutateAsync(template.id),
                    "New draft version created",
                    "Could not create a version",
                  )
                }
              >
                <GitBranch className="h-4 w-4" />
                Create Next Version
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={updateMutation.isPending}
                  onClick={() =>
                    void save().then(
                      (ok) =>
                        ok &&
                        toast({
                          title: "Template draft saved",
                          variant: "success",
                        }),
                    )
                  }
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  loading={publishMutation.isPending}
                  onClick={() => void handlePublish()}
                >
                  <Send className="h-4 w-4" />
                  Publish V{template.version}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {locked ? (
        <Alert variant="info" title={`V${template.version} is locked`}>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
            Proposals created from this version keep their snapshot. Use Create
            Next Version for structural changes.
          </span>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Template Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Document Title" required error={errors.title}>
                {(fp) => (
                  <Input
                    {...fp}
                    value={title}
                    disabled={readOnly}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Internal Name" required error={errors.name}>
                {(fp) => (
                  <Input
                    {...fp}
                    value={name}
                    disabled={readOnly}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Code" hint="Stored upper-case">
                {(fp) => (
                  <Input
                    {...fp}
                    value={code}
                    disabled={readOnly}
                    onChange={(e) => setCode(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Department">
                {(fp) => (
                  <Input
                    {...fp}
                    value={department}
                    disabled={readOnly}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Category">
                {(fp) => (
                  <Input
                    {...fp}
                    value={category}
                    disabled={readOnly}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Description">
                {(fp) => (
                  <Textarea
                    {...fp}
                    rows={2}
                    value={description}
                    disabled={readOnly}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                )}
              </FormField>
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Sections ({sections.length})
            </h2>
            {readOnly ? (
              <ol className="flex flex-col gap-1.5">
                {[...sections]
                  .sort((a, b) => a.order - b.order)
                  .map((s, i) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-theme-sm dark:border-gray-800"
                    >
                      <span>
                        {i + 1}. {s.title}
                        {s.required ? (
                          <span className="text-error-500"> *</span>
                        ) : null}
                      </span>
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {s.type.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
              </ol>
            ) : (
              <SectionBuilder sections={sections} onChange={setSections} />
            )}
          </Card>
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Live Preview
              </h2>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Uses your Proposal Settings branding
              </span>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-gray-100 p-3 dark:bg-gray-800">
              <ProposalDocumentSheet
                settings={settings.data}
                data={{
                  proposalNumber: "PROP-SAMPLE-0001",
                  title,
                  statusLabel: "Preview",
                  isDraft: false,
                  proposalDate: todayInput(),
                  dueDate: null,
                  clientName: "Sample Client",
                  projectName: "Sample Project",
                  projectCode: "TXW/PRJ/ME/26-27/001",
                  preparedBy: "Project Team",
                  templateTitle: title,
                  templateVersion: template.version,
                  sections,
                  values: {},
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
