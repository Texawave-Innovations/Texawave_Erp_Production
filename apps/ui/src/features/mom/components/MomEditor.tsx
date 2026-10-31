"use client";

import type {
  MomAgendaItem,
  MomAttendee,
  MomDocument,
  MomNoteRow,
  MomSectionConfig,
  MomTemplate,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  GitBranch,
  History,
  Layers,
  MapPin,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { useProjects } from "@/features/projects/hooks";
import {
  errorMessage,
  todayInput,
  toDateInput,
} from "@/features/projects/format";
import {
  useArchiveMomDocument,
  useCreateMomDocument,
  useDeleteMomDocument,
  useFinalizeMomDocument,
  useFinalizeMomRevision,
  useMomDocument,
  useMomTemplates,
  useRestoreMomDocument,
  useStartMomRevision,
  useUpdateMomDocument,
} from "../hooks";
import { MOM_DELETE, MOM_READ, MOM_WRITE } from "../permissions";
import {
  FALLBACK_MOM_SECTIONS,
  documentSections,
  momStatusLabel,
  momStatusTone,
  readFreeText,
  rowId,
  toSheetData,
  writeFreeText,
  attendanceOf,
  type MomSheetData,
} from "../utils";
import { AgendaListManager } from "./AgendaListManager";
import {
  AttendeeListManager,
  type AttendeeListManagerHandle,
} from "./AttendeeListManager";
import { MeetingNotesTable } from "./MeetingNotesTable";
import { MomDocumentSheet } from "./MomDocumentSheet";
import { MomPreviewModal } from "./MomPreviewModal";
import { MomRevisionHistoryModal } from "./MomRevisionHistoryModal";
import { StartRevisionDialog } from "./StartRevisionDialog";

export type MomEditorMode = "create" | "edit" | "view";

const DEFAULT_TIMEZONE = "IST (UTC+05:30)";

interface EditorState {
  projectId: number | null;
  templateId: number | null;
  sections: MomSectionConfig[];
  meetingTitle: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  attendees: MomAttendee[];
  absentees: MomAttendee[];
  agenda: MomAgendaItem[];
  notes: MomNoteRow[];
  freeText: Record<string, string>;
}

/** Legacy `validateMomDraft` / `validateMomFinalize` — the API re-checks
 * finalization (`MOM_INCOMPLETE`); this only gives instant feedback. */
function validate(state: EditorState, finalize: boolean): string[] {
  const errors: string[] = [];
  if (!state.projectId)
    errors.push("Select the project this meeting belongs to.");
  if (!state.meetingTitle.trim()) errors.push("Meeting title is required.");
  if (!state.meetingDate) errors.push("Meeting date is required.");
  if (!finalize) return errors;
  if (!state.startTime || !state.endTime)
    errors.push("Start and end time are required to finalize.");
  if (state.startTime && state.endTime && state.endTime <= state.startTime) {
    errors.push("End time must be after the start time.");
  }
  if (!state.location.trim()) {
    errors.push("Meeting location or virtual link is required to finalize.");
  }
  if (!state.attendees.some((a) => attendanceOf(a) !== "absent")) {
    errors.push("At least one attendee must be present or remote.");
  }
  if (
    !state.notes.some(
      (n) =>
        n.agendaItem?.trim() ||
        n.discussionPoints?.trim() ||
        n.actionItems?.trim(),
    )
  ) {
    errors.push(
      "Add at least one meeting notes row with discussion points or action items.",
    );
  }
  return errors;
}

function cloneRows<T extends { id: string }>(
  rows: unknown,
  prefix: string,
): T[] {
  return Array.isArray(rows)
    ? (rows as T[]).map((r) => ({ ...r, id: rowId(prefix) }))
    : [];
}

function templateSections(t: MomTemplate | undefined): MomSectionConfig[] {
  return t && t.sectionsJson.length > 0
    ? t.sectionsJson
    : FALLBACK_MOM_SECTIONS;
}

function defaultFreeText(sections: MomSectionConfig[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const s of sections) {
    if (s.type === "free_text") result[s.id] = s.defaultContent ?? "";
  }
  return result;
}

function stateFromDocument(doc: MomDocument): EditorState {
  const sections = documentSections(doc.templateSnapshot);
  return {
    projectId: doc.projectId,
    templateId: doc.templateId,
    sections,
    meetingTitle: doc.meetingTitle,
    meetingDate: toDateInput(doc.meetingDate),
    startTime: doc.startTime ?? "",
    endTime: doc.endTime ?? "",
    timezone: doc.timezone ?? DEFAULT_TIMEZONE,
    location: doc.location ?? "",
    attendees: (doc.attendeesJson ?? []).map((a, idx) => ({
      ...a,
      id: a.id || `att_${idx}_${(a.name || "").replace(/\s+/g, "_")}`,
    })),
    absentees: (doc.absenteesJson ?? []).map((a, idx) => ({
      ...a,
      id: a.id || `abs_${idx}_${(a.name || "").replace(/\s+/g, "_")}`,
    })),
    agenda: doc.agendaJson ?? [],
    notes: doc.meetingNotesJson ?? [],
    freeText: readFreeText(
      sections,
      doc.freeTextContent,
      doc.additionalSectionsJson,
    ),
  };
}

export interface MomEditorProps {
  mode: MomEditorMode;
  id?: number | undefined;
}

/** Legacy `mom/pages/MomEditorPage.tsx` (create / edit / view in one page). */
export function MomEditor({ mode, id }: MomEditorProps) {
  const canRead = usePermission(MOM_READ);
  const docQuery = useMomDocument(mode === "create" ? 0 : (id ?? 0));
  const templatesQuery = useMomTemplates();

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Minutes of Meeting"
      >
        Ask an administrator for the <code>{MOM_READ}</code> permission.
      </Alert>
    );
  }

  if (mode !== "create") {
    if (docQuery.isPending) return <EditorSkeleton />;
    if (docQuery.isError) {
      const err = docQuery.error;
      if (err instanceof ApiError && err.isPermissionError) {
        return (
          <Alert
            variant="warning"
            title="You don't have access to Minutes of Meeting"
          >
            Ask an administrator for the <code>{MOM_READ}</code> permission.
          </Alert>
        );
      }
      if (err instanceof ApiError && err.isNotFound) {
        return (
          <Alert variant="warning" title="Meeting record not found">
            It may have been deleted. Return to the register to pick another
            one.
          </Alert>
        );
      }
      return <ErrorState onRetry={() => void docQuery.refetch()} />;
    }
    return (
      <EditorBody
        key={`${docQuery.data.id}-${mode}-${docQuery.data.versionToken ?? ""}`}
        mode={mode}
        document={docQuery.data}
        templates={templatesQuery.data ?? []}
        onReload={() => void docQuery.refetch()}
      />
    );
  }

  if (templatesQuery.isPending) return <EditorSkeleton />;
  return (
    <EditorBody
      key="create"
      mode="create"
      document={null}
      templates={templatesQuery.data ?? []}
      onReload={() => undefined}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function EditorBody({
  mode,
  document,
  templates,
  onReload,
}: {
  mode: MomEditorMode;
  document: MomDocument | null;
  templates: MomTemplate[];
  onReload: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const userName = useAuthStore((s) => s.user?.fullName);

  const canWrite = usePermission(MOM_WRITE);
  const canDelete = usePermission(MOM_DELETE);
  const attendeeManagerRef = useRef<AttendeeListManagerHandle>(null);

  const projectsQuery = useProjects({ limit: 100 });
  const projects = projectsQuery.data?.data ?? [];

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.status === "active"),
    [templates],
  );

  const createMutation = useCreateMomDocument();
  const updateMutation = useUpdateMomDocument();
  const finalizeMutation = useFinalizeMomDocument();
  const finalizeRevisionMutation = useFinalizeMomRevision();
  const startRevisionMutation = useStartMomRevision();
  const archiveMutation = useArchiveMomDocument();
  const restoreMutation = useRestoreMomDocument();
  const deleteMutation = useDeleteMomDocument();

  const status = document?.status ?? "draft";
  const isArchived = status === "archived";
  const editable =
    mode !== "view" &&
    canWrite &&
    !isArchived &&
    (document === null ||
      status === "draft" ||
      document.workingRevision !== null);
  const readOnly = !editable;

  const [state, setState] = useState<EditorState>(() => {
    if (document) return stateFromDocument(document);
    const preselect = Number(searchParams.get("projectId")) || null;
    const template =
      activeTemplates.find((t) => t.isDefault) ??
      activeTemplates[0] ??
      undefined;
    const sections = templateSections(template);
    return {
      projectId: preselect,
      templateId: template?.id ?? null,
      sections,
      meetingTitle: "Project Review & Alignment Meeting",
      meetingDate: todayInput(),
      startTime: "10:00",
      endTime: "11:00",
      timezone: DEFAULT_TIMEZONE,
      location: "",
      attendees: userName
        ? [
            {
              id: rowId("att"),
              name: userName,
              role: "Project Lead",
              attendance: "present",
            },
          ]
        : [],
      absentees: [],
      agenda: cloneRows<MomAgendaItem>(template?.defaultAgendaJson, "ag"),
      notes: cloneRows<MomNoteRow>(template?.defaultNoteRowsJson, "nr"),
      freeText: defaultFreeText(sections),
    };
  });
  const [versionToken, setVersionToken] = useState<string | null>(
    document?.versionToken ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | "leave" | null>(
    null,
  );
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!dirty || readOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, readOnly]);

  function patch(next: Partial<EditorState>) {
    setState((prev) => ({ ...prev, ...next }));
    setDirty(true);
    setErrors([]);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      for (const k of Object.keys(next)) {
        delete updated[k];
      }
      return updated;
    });
  }

  function applyTemplate(templateId: number) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const sections = templateSections(t);
    const agenda = cloneRows<MomAgendaItem>(t.defaultAgendaJson, "ag");
    const notes = cloneRows<MomNoteRow>(t.defaultNoteRowsJson, "nr");
    patch({
      templateId: t.id,
      sections,
      ...(agenda.length > 0 ? { agenda } : {}),
      ...(notes.length > 0 ? { notes } : {}),
      freeText: { ...defaultFreeText(sections), ...state.freeText },
    });
    toast({
      title: `Applied template "${t.name}" (V${t.version})`,
      variant: "success",
    });
  }

  const selectedProject = projects.find((p) => p.id === state.projectId);
  const selectedTemplate = templates.find((t) => t.id === state.templateId);
  const visibleSections = useMemo(
    () =>
      [...state.sections]
        .filter((s) => s.visible)
        .sort((a, b) => a.order - b.order),
    [state.sections],
  );

  function buildPayload() {
    const { freeTextContent, additionalSectionsJson } = writeFreeText(
      state.sections,
      state.freeText,
    );
    return {
      meetingTitle: state.meetingTitle.trim(),
      meetingDate: state.meetingDate,
      startTime: state.startTime || undefined,
      endTime: state.endTime || undefined,
      timezone: state.timezone || undefined,
      location: state.location.trim() || undefined,
      projectId: state.projectId ?? undefined,
      attendeesJson: state.attendees,
      absenteesJson: state.absentees,
      agendaJson: state.agenda,
      meetingNotesJson: state.notes,
      additionalSectionsJson,
      freeTextContent,
    };
  }

  /** Persists the form; returns the saved document id. */
  async function persist(): Promise<number> {
    const payload = buildPayload();
    if (!document) {
      const created = await createMutation.mutateAsync({
        ...payload,
        ...(state.templateId ? { templateId: state.templateId } : {}),
      });
      return created.id;
    }
    const updated = await updateMutation.mutateAsync({
      id: document.id,
      input: { ...payload, ...(versionToken ? { versionToken } : {}) },
    });
    setVersionToken(updated.versionToken);
    return updated.id;
  }

  function handleSaveError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.statusCode === 409) {
      setConflict(true);
      return;
    }
    toast({
      title: fallback,
      description: errorMessage(
        err,
        "Your changes are still in the editor — try again.",
      ),
      variant: "error",
    });
  }

  async function handleSave(finalize: boolean) {
    if (attendeeManagerRef.current?.hasPendingDraft()) {
      const addedName = attendeeManagerRef.current.commitPendingDraft();
      if (addedName) {
        toast({
          title: "Participant added",
          description: `${addedName} was still in the "Add Meeting Participant" row, so we added them before saving. Review the attendee list and save again.`,
        });
      }
      return;
    }

    const fErrors: Record<string, string> = {};
    if (!state.projectId) fErrors.projectId = "Project is required.";
    if (!state.meetingTitle.trim())
      fErrors.meetingTitle = "Meeting title is required.";
    if (!state.meetingDate) fErrors.meetingDate = "Meeting date is required.";
    if (finalize) {
      if (!state.startTime) fErrors.startTime = "Start time is required.";
      if (!state.endTime) fErrors.endTime = "End time is required.";
      else if (state.startTime && state.endTime <= state.startTime) {
        fErrors.endTime = "End time must be after the start time.";
      }
      if (!state.location.trim()) {
        fErrors.location =
          "Meeting location or virtual link is required to finalize.";
      }
    }
    setFieldErrors(fErrors);

    const problems = validate(state, finalize);
    if (problems.length > 0) {
      setErrors(problems);
      if (fErrors.location) {
        const el =
          typeof window !== "undefined"
            ? window.document.getElementById("mom-location-input")
            : null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
      return;
    }
    setSaving(true);
    try {
      const savedId = await persist();
      if (finalize) {
        if (document?.workingRevision) {
          await finalizeRevisionMutation.mutateAsync(savedId);
        } else {
          await finalizeMutation.mutateAsync(savedId);
        }
      }
      setDirty(false);
      toast({
        title: finalize
          ? document?.workingRevision
            ? `Revision ${document.workingRevision} finalized`
            : "Meeting minutes finalized"
          : document
            ? "Draft saved"
            : "Draft created",
        variant: "success",
      });
      // A saved draft stays in the editor; a finalized one opens read-only.
      router.push(
        finalize ? `/projects/mom/${savedId}` : `/projects/mom/${savedId}/edit`,
      );
    } catch (err) {
      handleSaveError(
        err,
        finalize
          ? "Could not finalize these minutes"
          : "Could not save this draft",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStartRevision(reason: string) {
    if (!document) return;
    try {
      await startRevisionMutation.mutateAsync({
        id: document.id,
        input: { reason },
      });
      setRevisionOpen(false);
      toast({
        title: `Revision ${document.currentRevision + 1} started`,
        variant: "success",
      });
      router.push(`/projects/mom/${document.id}/edit`);
    } catch (err) {
      toast({
        title: "Could not start a revision",
        description: errorMessage(err, "Please try again."),
        variant: "error",
      });
    }
  }

  async function handleArchive() {
    if (!document) return;
    try {
      await archiveMutation.mutateAsync(document.id);
      setConfirm(null);
      toast({ title: `${document.reference} archived`, variant: "success" });
      router.push(`/projects/mom/${document.id}`);
    } catch (err) {
      toast({
        title: "Could not archive",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  async function handleRestore() {
    if (!document) return;
    try {
      await restoreMutation.mutateAsync(document.id);
      toast({ title: `${document.reference} restored`, variant: "success" });
    } catch (err) {
      toast({
        title: "Could not restore",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  async function handleDelete() {
    if (!document) return;
    try {
      await deleteMutation.mutateAsync(document.id);
      setConfirm(null);
      toast({ title: `${document.reference} deleted`, variant: "success" });
      router.push("/projects/mom");
    } catch (err) {
      toast({
        title: "Could not delete",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  function leave() {
    if (dirty && !readOnly) {
      setConfirm("leave");
      return;
    }
    router.push("/projects/mom");
  }

  const previewData: MomSheetData = document
    ? {
        ...toSheetData(document),
        ...(readOnly
          ? {}
          : {
              meetingTitle: state.meetingTitle,
              meetingDate: state.meetingDate,
              startTime: state.startTime || null,
              endTime: state.endTime || null,
              timezone: state.timezone || null,
              location: state.location || null,
              attendees: state.attendees,
              absentees: state.absentees,
              agenda: state.agenda,
              notes: state.notes,
              freeText: state.freeText,
              sections: visibleSections,
            }),
      }
    : {
        reference: "Assigned on save",
        statusLabel: "Draft",
        isDraft: true,
        revision: 1,
        templateTitle: selectedTemplate?.name ?? null,
        templateVersion: selectedTemplate?.version ?? null,
        meetingTitle: state.meetingTitle,
        meetingDate: state.meetingDate,
        startTime: state.startTime || null,
        endTime: state.endTime || null,
        timezone: state.timezone || null,
        location: state.location || null,
        projectCode: selectedProject?.projectCode ?? null,
        projectName: selectedProject?.name ?? null,
        clientName:
          selectedProject?.customerName ??
          selectedProject?.customer?.name ??
          null,
        attendees: state.attendees,
        absentees: state.absentees,
        agenda: state.agenda,
        notes: state.notes,
        freeText: state.freeText,
        sections: visibleSections,
      };

  const revisionLabel = document?.workingRevision
    ? `Rev ${document.workingRevision} (working)`
    : `Rev ${document?.currentRevision ?? 1}`;

  const steps = [
    { label: "Select Project", done: Boolean(state.projectId) },
    { label: "Apply Template", done: Boolean(state.templateId) },
    { label: "Enter Content", done: Boolean(state.meetingTitle.trim()) },
    { label: "Save Draft", done: Boolean(document) },
    {
      label: "Preview & Finalize",
      done: status === "finalized" && !document?.workingRevision,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {!readOnly ? (
        <ol className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-3 text-theme-xs dark:border-gray-800 dark:bg-gray-900">
          {steps.map((step, i) => (
            <li key={step.label} className="flex shrink-0 items-center gap-2">
              {i > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
              ) : null}
              <span
                className={
                  step.done
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-theme-xs font-bold text-white"
                    : "flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-theme-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }
              >
                {i + 1}
              </span>
              <span
                className={
                  step.done
                    ? "font-semibold text-gray-900 dark:text-white/90"
                    : "text-gray-500 dark:text-gray-400"
                }
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {/* Action bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft className="h-4 w-4" />
            Register
          </Button>
          <span className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-0.5 text-theme-xs font-bold text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300">
            {document?.reference ?? "Reference assigned on save"}
          </span>
          {document ? (
            <StatusBadge
              label={momStatusLabel(document)}
              colorToken={momStatusTone(document)}
            />
          ) : (
            <StatusBadge label="New draft" colorToken="brand" />
          )}
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
            {revisionLabel}
          </span>
          {dirty && !readOnly ? (
            <span className="rounded-lg border border-warning-200 bg-warning-50 px-2 py-0.5 text-theme-xs font-semibold text-warning-700 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-300">
              Unsaved changes
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {document ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              History & Revisions
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            Preview & PDF
          </Button>

          {readOnly && document && canWrite ? (
            <>
              {isArchived ? (
                <Button
                  size="sm"
                  loading={restoreMutation.isPending}
                  onClick={() => void handleRestore()}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore Document
                </Button>
              ) : null}
              {status === "draft" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/projects/mom/${document.id}/edit`)
                  }
                >
                  <Pencil className="h-4 w-4" />
                  Edit Draft
                </Button>
              ) : null}
              {status === "finalized" && document.workingRevision ? (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/projects/mom/${document.id}/edit`)
                  }
                >
                  <Pencil className="h-4 w-4" />
                  Continue Revision {document.workingRevision}
                </Button>
              ) : null}
              {status === "finalized" && !document.workingRevision ? (
                <Button size="sm" onClick={() => setRevisionOpen(true)}>
                  <GitBranch className="h-4 w-4" />
                  Create Revision
                </Button>
              ) : null}
            </>
          ) : null}

          {!readOnly ? (
            <Button
              variant="secondary"
              size="sm"
              loading={
                saving &&
                !finalizeMutation.isPending &&
                !finalizeRevisionMutation.isPending
              }
              disabled={saving}
              onClick={() => void handleSave(false)}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
          ) : null}

          {document && canDelete && !isArchived ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm("archive")}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          ) : null}
          {document && canDelete && status === "draft" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm("delete")}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {mode !== "view" && readOnly && document ? (
        <Alert variant="info" title="This document is read-only">
          {isArchived
            ? "Archived minutes must be restored before they can be edited."
            : status === "finalized"
              ? "Finalized minutes are locked. Use Create Revision to unlock a working revision."
              : "You don't have permission to edit meeting minutes."}
        </Alert>
      ) : null}

      {document?.workingRevision && !readOnly ? (
        <Alert
          variant="warning"
          title={`Working revision ${document.workingRevision}`}
        >
          Reason: {document.workingRevisionReason ?? "—"}. Revision{" "}
          {document.currentRevision - 1} stays on record in History & Revisions.
        </Alert>
      ) : null}

      {errors.length > 0 ? (
        <Alert variant="error" title="Please complete the following">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {readOnly && document ? (
        <Card className="overflow-hidden p-0">
          <div className="bg-gray-100 p-3 dark:bg-gray-800">
            <div className="shadow-theme-sm">
              <MomDocumentSheet data={previewData} />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3]" />
          <div className="flex flex-col gap-8 p-5 sm:p-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-theme-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">
                Official Minutes of Meeting
              </span>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Template:{" "}
                <strong className="text-gray-800 dark:text-gray-200">
                  {selectedTemplate?.name ??
                    document?.templateTitle ??
                    "Standard"}
                </strong>
                {(selectedTemplate?.version ?? document?.templateVersion)
                  ? ` (V${selectedTemplate?.version ?? document?.templateVersion})`
                  : ""}{" "}
                · {revisionLabel}
              </p>
              <div className="w-full max-w-xl">
                <Input
                  aria-label="Meeting title"
                  placeholder="Enter Meeting Title *"
                  value={state.meetingTitle}
                  onChange={(e) => patch({ meetingTitle: e.target.value })}
                  className="text-center text-lg font-bold"
                />
              </div>
            </div>

            {visibleSections.map((section) => {
              switch (section.type) {
                case "company_header":
                  return null;
                case "meeting_details":
                  return (
                    <div
                      key={section.id}
                      className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/50 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      <FormField label="Linked Project" required>
                        {(fp) => (
                          <Select
                            {...fp}
                            prefixIcon={
                              <Building2 className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                            }
                            value={
                              state.projectId ? String(state.projectId) : ""
                            }
                            onChange={(e) =>
                              patch({
                                projectId: Number(e.target.value) || null,
                              })
                            }
                            className="w-full"
                          >
                            <option value="">
                              {projectsQuery.isPending
                                ? "Loading projects..."
                                : "Select project"}
                            </option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.projectCode}] {p.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label="Template">
                        {(fp) => (
                          <div className="w-full min-w-0">
                            {mode === "create" ? (
                              <Select
                                {...fp}
                                prefixIcon={
                                  <Layers className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                                }
                                value={
                                  state.templateId
                                    ? String(state.templateId)
                                    : ""
                                }
                                onChange={(e) =>
                                  applyTemplate(Number(e.target.value))
                                }
                                className="w-full"
                              >
                                <option value="" disabled>
                                  {activeTemplates.length === 0
                                    ? "No published templates — using standard layout"
                                    : "Select template"}
                                </option>
                                {activeTemplates.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} (V{t.version})
                                    {t.isDefault ? " — default" : ""}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <p className="flex items-center gap-2 py-2 text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
                                <Layers className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                                <span>
                                  {document?.templateTitle ?? "Standard"}
                                  {document?.templateVersion
                                    ? ` (V${document.templateVersion})`
                                    : ""}
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </FormField>
                      <FormField label="Meeting Date" required>
                        {(fp) => (
                          <Input
                            {...fp}
                            type="date"
                            iconClassName="text-brand-600 dark:text-brand-400"
                            value={state.meetingDate}
                            onChange={(e) =>
                              patch({ meetingDate: e.target.value })
                            }
                          />
                        )}
                      </FormField>
                      <FormField label="Start / End Time">
                        {() => (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                            <Input
                              aria-label="Start time"
                              type="time"
                              value={state.startTime}
                              onChange={(e) =>
                                patch({ startTime: e.target.value })
                              }
                            />
                            <span className="text-gray-400">–</span>
                            <Input
                              aria-label="End time"
                              type="time"
                              value={state.endTime}
                              onChange={(e) =>
                                patch({ endTime: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </FormField>
                      <FormField label="Timezone">
                        {(fp) => (
                          <Input
                            {...fp}
                            value={state.timezone}
                            onChange={(e) =>
                              patch({ timezone: e.target.value })
                            }
                          />
                        )}
                      </FormField>
                      <FormField
                        label="Location / Meeting Link"
                        error={fieldErrors.location}
                        required={Boolean(fieldErrors.location)}
                      >
                        {(fp) => (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                            <Input
                              {...fp}
                              id="mom-location-input"
                              placeholder="Meeting room or virtual link"
                              value={state.location}
                              invalid={Boolean(fieldErrors.location)}
                              onChange={(e) =>
                                patch({ location: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </FormField>
                    </div>
                  );
                case "people_lists":
                  return (
                    <section key={section.id} className="flex flex-col gap-3">
                      <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                        {section.title}
                      </h3>
                      <AttendeeListManager
                        ref={attendeeManagerRef}
                        attendees={state.attendees}
                        absentees={state.absentees}
                        onChange={({ attendees, absentees }) =>
                          patch({ attendees, absentees })
                        }
                      />
                    </section>
                  );
                case "agenda_list":
                  return (
                    <AgendaListManager
                      key={section.id}
                      title={section.title}
                      agenda={state.agenda}
                      onChange={(agenda) => patch({ agenda })}
                    />
                  );
                case "meeting_notes_table":
                  return (
                    <MeetingNotesTable
                      key={section.id}
                      title={section.title}
                      rows={state.notes}
                      agenda={state.agenda}
                      onChange={(notes) => patch({ notes })}
                    />
                  );
                case "free_text":
                  return (
                    <FormField
                      key={section.id}
                      label={section.title}
                      required={section.required}
                    >
                      {(fp) => (
                        <Textarea
                          {...fp}
                          rows={4}
                          value={state.freeText[section.id] ?? ""}
                          onChange={(e) =>
                            patch({
                              freeText: {
                                ...state.freeText,
                                [section.id]: e.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </FormField>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </Card>
      )}

      {!readOnly ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Meeting Completion &amp; Finalization
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Verify attendance, agenda points, notes, and task assignments
              above before finalizing these minutes.
            </p>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-end gap-3 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              loading={
                saving &&
                !finalizeMutation.isPending &&
                !finalizeRevisionMutation.isPending
              }
              disabled={saving}
              onClick={() => void handleSave(false)}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              size="sm"
              loading={
                saving &&
                (finalizeMutation.isPending ||
                  finalizeRevisionMutation.isPending)
              }
              disabled={saving}
              onClick={() => void handleSave(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {document?.workingRevision
                ? `Finalize Rev ${document.workingRevision}`
                : "Finalize MoM"}
            </Button>
          </div>
        </div>
      ) : null}

      <MomPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={previewData}
      />
      <MomRevisionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        document={document}
      />
      {document ? (
        <StartRevisionDialog
          open={revisionOpen}
          onClose={() => setRevisionOpen(false)}
          currentRevision={document.currentRevision}
          loading={startRevisionMutation.isPending}
          onConfirm={handleStartRevision}
        />
      ) : null}

      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={handleArchive}
        title="Archive meeting minutes?"
        description={`${document?.reference ?? ""} will move to the archive. It stays in history and can be restored later.`}
        confirmText="Archive"
        variant="destructive"
        loading={archiveMutation.isPending}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Delete this draft?"
        description={`${document?.reference ?? ""} will be removed from the register.`}
        confirmText="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          router.push("/projects/mom");
        }}
        title="Discard unsaved changes?"
        description="You have unsaved changes in this meeting record."
        confirmText="Discard & leave"
        variant="destructive"
      />

      <Dialog
        open={conflict}
        onClose={() => setConflict(false)}
        size="md"
        title="Concurrent update detected"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setConflict(false);
                setVersionToken(null);
                toast({
                  title: "Overwrite enabled",
                  description:
                    "Save again to replace the server copy with your version.",
                  variant: "info",
                });
              }}
            >
              Keep my version
            </Button>
            <Button
              onClick={() => {
                setConflict(false);
                setDirty(false);
                onReload();
              }}
            >
              Reload remote copy
            </Button>
          </div>
        }
      >
        <div className="flex gap-3 text-theme-sm text-gray-700 dark:text-gray-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-error-600" />
          <p>
            Someone else saved this document while you were editing. Your save
            was stopped so nothing is silently lost — your inputs are still in
            the editor. Reload to see their changes, or keep your version and
            save again to overwrite.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
