"use client";

import type {
  ProposalDocument,
  ProposalSectionConfig,
  ProposalWorkflowAction,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
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
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  Lock,
  Save,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useProjects } from "@/features/projects/hooks";
import {
  errorMessage,
  formatDate,
  toDateInput,
} from "@/features/projects/format";
import {
  useDuplicateProposalDocument,
  useExtendProposalFollowup,
  useProposalDocument,
  useTransitionProposalDocument,
  useUpdateProposalDocument,
} from "../hooks";
import {
  PROPOSALS_READ,
  PROPOSALS_SEND,
  PROPOSALS_WRITE,
} from "../permissions";
import {
  ACTIONS_BY_STATUS,
  EDITABLE_STATUSES,
  PROPOSAL_STATUS_META,
  WORKFLOW_ACTION_META,
  flattenSections,
  followUpState,
  proposalCompleteness,
} from "../utils";
import { ExtendFollowupModal } from "./ExtendFollowupModal";
import { ProposalActivityTimeline } from "./ProposalActivityTimeline";
import { toProposalSheet } from "./ProposalDocumentSheet";
import { ProposalPreviewModal } from "./ProposalPreviewModal";
import { SectionRenderer } from "./SectionRenderer";
import {
  WorkflowActionDialog,
  type WorkflowActionTarget,
} from "./WorkflowActionDialog";

const AUTOSAVE_MS = 2500;

export interface ProposalDetailViewProps {
  id: number;
}

/** Legacy `proposals/ProposalEditor.tsx` — full-page editor bound to the
 * document's frozen template snapshot: metadata, completion meter with
 * validation issues, section navigator, debounced autosave (+ Ctrl/Cmd+S),
 * workflow actions with audit comments, follow-up extension, preview/PDF and
 * the audit trail. Content locks once the proposal leaves draft /
 * changes-requested (the API enforces the same rule). */
export function ProposalDetailView({ id }: ProposalDetailViewProps) {
  const canRead = usePermission(PROPOSALS_READ);
  const query = useProposalDocument(id);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to Proposal Documents"
      >
        Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
      </Alert>
    );
  }
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
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
          title="You don't have access to Proposal Documents"
        >
          Ask an administrator for the <code>{PROPOSALS_READ}</code> permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Alert variant="warning" title="Proposal not found">
          It may have been deleted.{" "}
          <Link href="/projects/proposals">Back to proposals</Link>
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  // Remount when the status changes so the form re-reads the saved values.
  return (
    <Editor
      key={`${query.data.id}-${query.data.status}`}
      proposal={query.data}
    />
  );
}

function Editor({ proposal }: { proposal: ProposalDocument }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(PROPOSALS_WRITE);
  const canSend = usePermission(PROPOSALS_SEND);
  const projectsQuery = useProjects({ limit: 100 });

  const updateMutation = useUpdateProposalDocument();
  const transitionMutation = useTransitionProposalDocument();
  const extendMutation = useExtendProposalFollowup();
  const duplicateMutation = useDuplicateProposalDocument();

  const editable = canWrite && EDITABLE_STATUSES.includes(proposal.status);
  const sections = useMemo(
    () =>
      Array.isArray(proposal.templateSnapshot)
        ? (proposal.templateSnapshot as ProposalSectionConfig[])
        : [],
    [proposal.templateSnapshot],
  );

  const [title, setTitle] = useState(proposal.title);
  const [clientName, setClientName] = useState(proposal.clientName ?? "");
  const [projectId, setProjectId] = useState(
    proposal.projectId ? String(proposal.projectId) : "",
  );
  const [proposalDate, setProposalDate] = useState(
    toDateInput(proposal.proposalDate),
  );
  const [followUpNotes, setFollowUpNotes] = useState(
    proposal.followUpNotes ?? "",
  );
  const [values, setValues] = useState<Record<string, unknown>>(
    proposal.sectionValues ?? {},
  );
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [workflowTarget, setWorkflowTarget] =
    useState<WorkflowActionTarget | null>(null);
  const savingRef = useRef(false);

  const createdBy =
    proposal.activities?.find((a) => a.action === "created")?.userName ?? null;
  const completeness = proposalCompleteness(
    { title, clientName, proposalDate },
    sections,
    values,
  );

  const save = useCallback(
    async (silent: boolean, returnToList = false): Promise<boolean> => {
      if (savingRef.current) return false;
      if (title.trim().length < 2) {
        if (!silent)
          toast({ title: "Proposal title is required", variant: "error" });
        return false;
      }
      savingRef.current = true;
      try {
        await updateMutation.mutateAsync({
          id: proposal.id,
          input: editable
            ? {
                title: title.trim(),
                clientName: clientName.trim() || undefined,
                ...(projectId && Number(projectId) !== proposal.projectId
                  ? { projectId: Number(projectId) }
                  : {}),
                proposalDate: proposalDate || undefined,
                sectionValues: values,
                followUpNotes,
              }
            : { followUpNotes },
        });
        setDirty(false);
        setLastSaved(new Date());
        setNow(Date.now());
        if (!silent) toast({ title: "Proposal saved", variant: "success" });
        if (returnToList) {
          router.push("/projects/proposals");
        }
        return true;
      } catch (err) {
        toast({
          title: silent ? "Autosave failed" : "Could not save the proposal",
          description: errorMessage(
            err,
            "Your changes are still on this page.",
          ),
          variant: "error",
        });
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [
      clientName,
      editable,
      followUpNotes,
      projectId,
      proposal.id,
      proposal.projectId,
      proposalDate,
      router,
      title,
      toast,
      updateMutation,
      values,
    ],
  );

  // Debounced autosave (legacy: 2.5 s after the last edit).
  useEffect(() => {
    if (!dirty || !canWrite || proposal.status === "archived") return undefined;
    const timer = window.setTimeout(() => void save(true), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, canWrite, proposal.status, save]);

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canWrite) void save(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canWrite, save]);

  // Refresh the "saved x ago" label.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function savedLabel(): string {
    if (dirty)
      return updateMutation.isPending ? "Saving..." : "Unsaved changes";
    if (!lastSaved) return "All changes saved";
    const secs = Math.max(0, Math.floor((now - lastSaved.getTime()) / 1000));
    if (secs < 5) return "Saved just now";
    if (secs < 60) return `Saved ${secs} seconds ago`;
    const mins = Math.floor(secs / 60);
    return `Saved ${mins} minute${mins > 1 ? "s" : ""} ago`;
  }

  async function runWorkflow(
    action: ProposalWorkflowAction,
    comments: string | undefined,
  ) {
    if (dirty && !(await save(true))) return;
    try {
      await transitionMutation.mutateAsync({
        id: proposal.id,
        input: { action, comments },
      });
      setWorkflowTarget(null);
      toast({
        title: `${proposal.proposalNumber}: ${WORKFLOW_ACTION_META[action].label}`,
        variant: "success",
      });
      router.push("/projects/proposals");
    } catch (err) {
      toast({
        title: "Could not update the status",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  async function handleDuplicate() {
    try {
      const copy = await duplicateMutation.mutateAsync(proposal.id);
      toast({
        title: `Duplicated as ${copy.proposalNumber}`,
        variant: "success",
      });
      router.push(`/projects/proposals/${copy.id}`);
    } catch (err) {
      toast({
        title: "Could not duplicate",
        description: errorMessage(err, ""),
        variant: "error",
      });
    }
  }

  const statusMeta = PROPOSAL_STATUS_META[proposal.status];
  const actions = canSend ? ACTIONS_BY_STATUS[proposal.status] : [];
  const followUp = followUpState(proposal.status, proposal.dueDate);
  const navSections = flattenSections(sections).filter(
    (s) => s.type !== "page_break" && s.type !== "spacer",
  );

  const sheetData = {
    ...toProposalSheet(proposal),
    title,
    clientName: clientName || null,
    proposalDate: proposalDate || null,
    preparedBy: createdBy,
    values,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#2454e8] via-[#1769f5] to-[#12cfe3] p-6 text-white shadow-lg lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link
              href="/projects/proposals"
              aria-label="Back to proposals"
              className="rounded-xl bg-white/20 p-1.5 hover:bg-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="rounded-xl border border-white/30 bg-white/20 px-2.5 py-0.5 text-theme-xs font-bold">
              {proposal.proposalNumber}
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-theme-xs font-bold text-brand-800">
              {statusMeta.label}
            </span>
            <span className="rounded-full border border-white/30 px-2.5 py-0.5 text-theme-xs font-semibold text-sky-50">
              Template: {proposal.templateTitle ?? "Standard"}
              {proposal.templateVersion
                ? ` (V${proposal.templateVersion})`
                : ""}
            </span>
          </div>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {title || "Untitled Proposal"}
          </h1>
          <p className="text-theme-sm text-sky-50/90">
            Client: <strong className="text-white">{clientName || "—"}</strong>{" "}
            · Project:{" "}
            <strong className="text-white">
              {proposal.projectName ?? "Independent"}
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canWrite ? (
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-theme-xs font-bold text-white shadow-xs backdrop-blur-md">
              {savedLabel()}
            </span>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="border-white/40 bg-white text-brand-700 shadow-md hover:bg-sky-50 hover:text-brand-800 focus-visible:ring-white dark:bg-gray-900 dark:text-cyan-300 dark:border-gray-700 dark:hover:bg-gray-800 disabled:bg-white/40 disabled:text-white/60 disabled:border-white/20"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            Preview & PDF
          </Button>
          {canWrite ? (
            <Button
              variant="secondary"
              size="sm"
              loading={duplicateMutation.isPending}
              className="border-white/40 bg-white text-brand-700 shadow-md hover:bg-sky-50 hover:text-brand-800 focus-visible:ring-white dark:bg-gray-900 dark:text-cyan-300 dark:border-gray-700 dark:hover:bg-gray-800 disabled:bg-white/40 disabled:text-white/60 disabled:border-white/20"
              onClick={() => void handleDuplicate()}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
          ) : null}
          {canWrite && proposal.status !== "archived" ? (
            <Button
              variant="secondary"
              size="sm"
              loading={updateMutation.isPending}
              className="border-white/40 bg-white text-brand-700 shadow-md hover:bg-sky-50 hover:text-brand-800 focus-visible:ring-white dark:bg-gray-900 dark:text-cyan-300 dark:border-gray-700 dark:hover:bg-gray-800 disabled:bg-white/40 disabled:text-white/60 disabled:border-white/20"
              onClick={() => void save(false, true)}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          ) : null}
        </div>
      </div>

      {!editable && proposal.status !== "archived" ? (
        <Alert variant="info" title={`Content locked — ${statusMeta.label}`}>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
            {canWrite
              ? "Proposal content can only change while it is a draft or has changes requested. Use Revert to Draft to unlock it. Follow-up notes stay editable."
              : "You can view this proposal but not edit it."}
          </span>
        </Alert>
      ) : null}

      {actions.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Workflow
              </h2>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Every transition is recorded with your name and comment in the
                audit trail.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={
                    WORKFLOW_ACTION_META[action].destructive
                      ? "secondary"
                      : action === "submit_for_review" ||
                          action === "review_approve" ||
                          action === "send_to_client" ||
                          action === "record_accepted"
                        ? "primary"
                        : "secondary"
                  }
                  onClick={() => {
                    if (
                      action === "submit_for_review" &&
                      completeness.issues.length > 0
                    ) {
                      toast({
                        title: "Complete the proposal before submitting",
                        description: completeness.issues
                          .slice(0, 3)
                          .join(" · "),
                        variant: "warning",
                      });
                      return;
                    }
                    setWorkflowTarget({ proposal, action });
                  }}
                >
                  <Send className="h-4 w-4" />
                  {WORKFLOW_ACTION_META[action].label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Navigator + completeness */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <p className="text-theme-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Completion
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={
                    completeness.percent === 100
                      ? "h-full rounded-full bg-success-500"
                      : "h-full rounded-full bg-brand-500"
                  }
                  style={{ width: `${completeness.percent}%` }}
                />
              </div>
              <span className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
                {completeness.percent}%
              </span>
            </div>
            {completeness.issues.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 text-theme-xs text-warning-700 dark:text-warning-300">
                {completeness.issues.slice(0, 6).map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-theme-xs text-success-700 dark:text-success-400">
                All required content is filled in.
              </p>
            )}
          </Card>
          {navSections.length > 0 ? (
            <Card>
              <p className="mb-2 text-theme-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Sections
              </p>
              <nav
                aria-label="Proposal sections"
                className="flex flex-col gap-0.5"
              >
                {navSections.map((s) => {
                  const v = values[s.id];
                  const filled =
                    typeof v === "string"
                      ? v.trim().length > 0
                      : Array.isArray(v)
                        ? v.length > 0
                        : Boolean(
                            v &&
                            typeof v === "object" &&
                            Object.values(v).some(Boolean),
                          );
                  return (
                    <a
                      key={s.id}
                      href={`#proposal-section-${s.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {filled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-600" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                      )}
                      <span className="truncate">{s.title}</span>
                      {s.required ? (
                        <span className="text-error-500">*</span>
                      ) : null}
                    </a>
                  );
                })}
              </nav>
            </Card>
          ) : null}
        </div>

        {/* Document */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Proposal Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Proposal Title" required>
                {(fp) => (
                  <Input
                    {...fp}
                    value={title}
                    disabled={!editable}
                    onChange={(e) => mark(setTitle)(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Proposal Number">
                {(fp) => (
                  <Input {...fp} value={proposal.proposalNumber} disabled />
                )}
              </FormField>
              <FormField label="Proposal Date">
                {(fp) => (
                  <Input
                    {...fp}
                    type="date"
                    value={proposalDate}
                    disabled={!editable}
                    onChange={(e) => mark(setProposalDate)(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Client Name">
                {(fp) => (
                  <Input
                    {...fp}
                    value={clientName}
                    disabled={!editable}
                    onChange={(e) => mark(setClientName)(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label="Linked Project">
                {(fp) => (
                  <Select
                    {...fp}
                    value={projectId}
                    disabled={!editable}
                    onChange={(e) => mark(setProjectId)(e.target.value)}
                  >
                    <option value="">
                      {proposal.projectName && !proposal.projectId
                        ? proposal.projectName
                        : "Independent / none"}
                    </option>
                    {(projectsQuery.data?.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.projectCode}] {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Prepared By">
                {(fp) => <Input {...fp} value={createdBy ?? "—"} disabled />}
              </FormField>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              Document Content
            </h2>
            {sections.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                This proposal was created without a template, so it has no
                structured sections. Use the details above and follow-up notes,
                or create a new proposal from a template.
              </p>
            ) : (
              <SectionRenderer
                sections={sections}
                values={values}
                onChange={mark(setValues)}
                readOnly={!editable}
              />
            )}
            {canWrite && editable ? (
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/projects/proposals")}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  loading={updateMutation.isPending}
                  onClick={() => void save(false, true)}
                >
                  <Save className="h-4 w-4" />
                  Save & Return
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Follow-up + audit */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-theme-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  Follow-up Due
                </p>
                <p
                  className={
                    followUp === "overdue"
                      ? "text-theme-sm font-bold text-error-600 dark:text-error-400"
                      : followUp === "today"
                        ? "text-theme-sm font-bold text-warning-600 dark:text-warning-400"
                        : "text-theme-sm font-semibold text-gray-900 dark:text-white/90"
                  }
                >
                  {proposal.dueDate ? formatDate(proposal.dueDate) : "Not set"}
                  {followUp === "overdue"
                    ? " · overdue"
                    : followUp === "today"
                      ? " · today"
                      : ""}
                </p>
                {proposal.followUpExtensionCount > 0 ? (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Extended {proposal.followUpExtensionCount}x
                  </p>
                ) : null}
              </div>
              {canWrite && proposal.status !== "archived" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExtendOpen(true)}
                >
                  <CalendarClock className="h-4 w-4" />
                  {proposal.dueDate ? "Extend" : "Set"}
                </Button>
              ) : null}
            </div>
            <div className="mt-3">
              <FormField label="Follow-up Notes">
                {(fp) => (
                  <Textarea
                    {...fp}
                    rows={3}
                    value={followUpNotes}
                    disabled={!canWrite || proposal.status === "archived"}
                    onChange={(e) => mark(setFollowUpNotes)(e.target.value)}
                  />
                )}
              </FormField>
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                Workflow & Audit History
              </h2>
              <StatusBadge
                label={statusMeta.label}
                colorToken={statusMeta.tone}
              />
            </div>
            <ProposalActivityTimeline activities={proposal.activities ?? []} />
          </Card>
        </div>
      </div>

      <ProposalPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={sheetData}
      />
      <ExtendFollowupModal
        proposal={extendOpen ? proposal : null}
        onClose={() => setExtendOpen(false)}
        loading={extendMutation.isPending}
        onConfirm={async ({ dueDate, reason }) => {
          try {
            await extendMutation.mutateAsync({
              id: proposal.id,
              input: { dueDate, reason },
            });
            toast({
              title: `Follow-up set to ${formatDate(dueDate)}`,
              variant: "success",
            });
            setExtendOpen(false);
          } catch (err) {
            toast({
              title: "Could not update the follow-up",
              description: errorMessage(err, ""),
              variant: "error",
            });
          }
        }}
      />
      <WorkflowActionDialog
        target={workflowTarget}
        onClose={() => setWorkflowTarget(null)}
        loading={transitionMutation.isPending}
        onConfirm={(comments) =>
          workflowTarget
            ? runWorkflow(workflowTarget.action, comments)
            : undefined
        }
      />
    </div>
  );
}
