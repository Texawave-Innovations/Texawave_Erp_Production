"use client";

import type {
  MomAgendaItem,
  MomNoteRow,
  MomSectionConfig,
  MomTemplate,
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
  useCreateMomTemplateVersion,
  useDuplicateMomTemplate,
  useMomTemplate,
  usePublishMomTemplate,
  useUpdateMomTemplate,
} from "../hooks";
import { MOM_MANAGE_TEMPLATES, MOM_READ } from "../permissions";
import { FALLBACK_MOM_SECTIONS, type MomSheetData } from "../utils";
import { AgendaListManager } from "./AgendaListManager";
import { MeetingNotesTable } from "./MeetingNotesTable";
import { MomDocumentSheet } from "./MomDocumentSheet";
import { MomSectionBuilder } from "./MomSectionBuilder";

export interface MomTemplateBuilderViewProps {
  templateId: number;
}

/** Legacy `mom/pages/MomTemplateBuilderPage.tsx`. */
export function MomTemplateBuilderView({
  templateId,
}: MomTemplateBuilderViewProps) {
  const canRead = usePermission(MOM_READ);
  const query = useMomTemplate(templateId);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to MoM Templates">
        Ask an administrator for the <code>{MOM_READ}</code> permission.
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
        <Alert variant="warning" title="You don't have access to MoM Templates">
          Ask an administrator for the <code>{MOM_READ}</code> permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Alert variant="warning" title="Template not found">
          It may have been deleted.{" "}
          <Link href="/projects/mom/templates">Back to templates</Link>
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

function Builder({ template }: { template: MomTemplate }) {
  const router = useRouter();
  const { toast } = useToast();
  const canManage = usePermission(MOM_MANAGE_TEMPLATES);
  const updateMutation = useUpdateMomTemplate();
  const publishMutation = usePublishMomTemplate();
  const versionMutation = useCreateMomTemplateVersion();
  const duplicateMutation = useDuplicateMomTemplate();

  const locked = template.status !== "draft";
  const readOnly = locked || !canManage;

  const [name, setName] = useState(template.name);
  const [code, setCode] = useState(template.code ?? "");
  const [category, setCategory] = useState(template.category ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const [sections, setSections] = useState<MomSectionConfig[]>(
    template.sectionsJson.length > 0
      ? template.sectionsJson
      : FALLBACK_MOM_SECTIONS,
  );
  const [agenda, setAgenda] = useState<MomAgendaItem[]>(
    (template.defaultAgendaJson as MomAgendaItem[]) ?? [],
  );
  const [notes, setNotes] = useState<MomNoteRow[]>(
    (template.defaultNoteRowsJson as MomNoteRow[]) ?? [],
  );
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  async function save(): Promise<boolean> {
    if (name.trim().length < 2) {
      setNameError("Template name is required (at least 2 characters).");
      return false;
    }
    setNameError(undefined);
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        input: {
          name: name.trim(),
          code: code.trim() || undefined,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          sectionsJson: sections,
          defaultAgendaJson: agenda,
          defaultNoteRowsJson: notes,
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

  async function handleSave() {
    if (await save())
      toast({ title: "Template draft saved", variant: "success" });
  }

  async function handlePublish() {
    if (!(await save())) return;
    try {
      await publishMutation.mutateAsync(template.id);
      toast({
        title: `"${name.trim()}" V${template.version} published`,
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

  async function handleNewVersion() {
    try {
      const created = await versionMutation.mutateAsync(template.id);
      toast({ title: `Draft V${created.version} created`, variant: "success" });
      router.push(`/projects/mom/templates/${created.id}/builder`);
    } catch (err) {
      toast({
        title: "Could not create a new version",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  async function handleDuplicate() {
    try {
      const created = await duplicateMutation.mutateAsync(template.id);
      toast({ title: `Duplicated as "${created.name}"`, variant: "success" });
      router.push(`/projects/mom/templates/${created.id}/builder`);
    } catch (err) {
      toast({
        title: "Could not duplicate",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  const sampleSheet: MomSheetData = {
    reference: "MOM-SAMPLE-0001",
    statusLabel: "Preview",
    isDraft: false,
    revision: 1,
    templateTitle: name,
    templateVersion: template.version,
    meetingTitle: "Sample Project Review Meeting",
    meetingDate: todayInput(),
    startTime: "10:00",
    endTime: "11:00",
    timezone: "IST (UTC+05:30)",
    location: "Conference Room / Virtual Link",
    projectCode: "TXW/PRJ/ME/26-27/001",
    projectName: "Sample Project",
    clientName: "Sample Client",
    attendees: [
      { id: "s1", name: "Project Lead", role: "Lead", attendance: "present" },
      {
        id: "s2",
        name: "Design Engineer",
        role: "Engineer",
        attendance: "remote",
      },
    ],
    absentees: [
      { id: "s3", name: "QA Engineer", role: "QA", attendance: "absent" },
    ],
    agenda,
    notes,
    freeText: Object.fromEntries(
      sections
        .filter((s) => s.type === "free_text")
        .map((s) => [s.id, s.defaultContent ?? ""]),
    ),
    sections: [...sections]
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects/mom/templates"
            className="flex items-center gap-1 text-theme-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Templates
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white/90">
            {template.name}
          </h1>
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
            V{template.version}
          </span>
          <StatusBadge
            label={
              template.status === "active"
                ? "Published"
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
          {template.isDefault ? (
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-theme-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              Default
            </span>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={duplicateMutation.isPending}
              onClick={() => void handleDuplicate()}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            {locked ? (
              <Button
                size="sm"
                loading={versionMutation.isPending}
                onClick={() => void handleNewVersion()}
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
                  onClick={() => void handleSave()}
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
        <Alert
          variant="info"
          title={`V${template.version} is ${template.status === "active" ? "published" : "archived"} and locked`}
        >
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
            Locked versions keep already-issued minutes reproducible. Use Create
            Next Version to make changes.
          </span>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Template Metadata
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Template Name" required error={nameError}>
                {(fp) => (
                  <Input
                    {...fp}
                    value={name}
                    disabled={readOnly}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Code" hint="Stored upper-case, e.g. MOM-STD">
                {(fp) => (
                  <Input
                    {...fp}
                    value={code}
                    disabled={readOnly}
                    onChange={(e) => setCode(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Category">
                {(fp) => (
                  <Input
                    {...fp}
                    placeholder="e.g. Engineering & Project Operations"
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
              Configured Sections
            </h2>
            <MomSectionBuilder
              sections={sections}
              onChange={setSections}
              readOnly={readOnly}
            />
          </Card>

          <Card>
            <AgendaListManager
              title="Default Agenda (pre-filled into new meetings)"
              agenda={agenda}
              onChange={setAgenda}
              disabled={readOnly}
            />
          </Card>

          <Card>
            <MeetingNotesTable
              title="Default Notes Rows"
              rows={notes}
              agenda={agenda}
              onChange={setNotes}
              disabled={readOnly}
            />
          </Card>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Live Preview
              </h2>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Sample data
              </span>
            </div>
            <div className="max-h-[80vh] overflow-y-auto bg-gray-100 p-3 dark:bg-gray-800">
              <MomDocumentSheet data={sampleSheet} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
