// src/modules/projects/mom/pages/MomEditorPage.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  MomDocument,
  DEFAULT_MOM_COMPANY_HEADER,
  MomAttendee,
  MomAgendaItem,
  MomNoteRow,
  MomTemplate,
  OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
} from "../types/mom";
import {
  getMomById,
  saveMom,
  startWorkingRevision,
  finalizeMom,
  archiveMom,
  restoreMom,
  StaleSaveConflictError,
} from "../services/momService";
import { hasMomPermission } from "../services/momPermissions";
import { getMomTemplates } from "../services/momTemplateService";
import { validateMomDraft, validateMomFinalize } from "../utils/momValidation";
import { getAllRecords } from "@/services/firebase";
import { Project } from "../../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Edit,
  History,
  Eye,
  Layers,
  ChevronRight,
  GitBranch,
  Archive,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { MeetingNotesTable } from "../components/MeetingNotesTable";
import { AttendeeListManager } from "../components/AttendeeListManager";
import { AgendaListManager } from "../components/AgendaListManager";
import { MomPreviewModal } from "../components/MomPreviewModal";
import { MomRevisionHistoryModal } from "../components/MomRevisionHistoryModal";

interface MomEditorPageProps {
  mode?: "create" | "edit" | "view";
}

export const MomEditorPage: React.FC<MomEditorPageProps> = ({
  mode: propMode,
}) => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Determine mode
  const mode =
    propMode ||
    (id
      ? window.location.pathname.endsWith("/edit")
        ? "edit"
        : "view"
      : "create");
  const isReadOnly = mode === "view";

  // Master Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<MomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Unsaved Changes Tracking
  const [isDirty, setIsDirty] = useState(false);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form State
  const [docId, setDocId] = useState<string | undefined>(id);
  const [reference, setReference] = useState<string>("Auto-generated on save");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id,
  );
  const [templateSnapshot, setTemplateSnapshot] = useState<MomTemplate>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
  );
  const [templateVersion, setTemplateVersion] = useState<string>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.version,
  );
  const [templateTitle, setTemplateTitle] = useState<string>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.name,
  );

  const [meetingTitle, setMeetingTitle] = useState<string>(
    "Project Review & Alignment Meeting",
  );
  const [meetingDate, setMeetingDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [timezone, setTimezone] = useState<string>("IST (UTC+05:30)");
  const [location, setLocation] = useState<string>(
    "TexaWave Conference Room / Virtual Meeting",
  );
  const [attendees, setAttendees] = useState<MomAttendee[]>([
    {
      id: "att_1",
      name: user?.name || user?.username || "Team Lead",
      role: "Project Lead",
      organization: "TexaWave Innovations",
      attendance: "present",
    },
  ]);
  const [absentees, setAbsentees] = useState<MomAttendee[]>([]);
  const [agenda, setAgenda] = useState<MomAgendaItem[]>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultAgenda || [],
  );
  const [meetingNotes, setMeetingNotes] = useState<MomNoteRow[]>(
    OFFICIAL_TEXAWAVE_MOM_TEMPLATE.defaultNoteRows || [],
  );
  const [currentStatus, setCurrentStatus] = useState<
    "draft" | "finalized" | "archived"
  >("draft");
  const [currentRevision, setCurrentRevision] = useState<number>(1);
  const [changeSummary, setChangeSummary] = useState<string>("");

  const [fullDocument, setFullDocument] = useState<MomDocument | null>(null);
  const [versionToken, setVersionToken] = useState<number | undefined>(
    undefined,
  );
  const [workingRevision, setWorkingRevision] = useState<number | undefined>(
    undefined,
  );
  const [workingRevisionReason, setWorkingRevisionReason] = useState<
    string | undefined
  >(undefined);

  // Modals
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionReasonInput, setRevisionReasonInput] = useState("");
  const [conflictDoc, setConflictDoc] = useState<MomDocument | null>(null);

  // Unsaved changes browser prompt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isReadOnly) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isReadOnly]);

  // Load project master and existing MoM (if id provided)
  // Load project master, templates, and existing MoM
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [allProjects, allTemplates] = await Promise.all([
          getAllRecords("projects"),
          getMomTemplates(),
        ]);
        setProjects(allProjects || []);
        setTemplates(allTemplates || []);

        if (id) {
          const doc = await getMomById(id, user);
          if (!doc) {
            setLoadError("Meeting record not found.");
            setLoading(false);
            return;
          }

          setFullDocument(doc);
          setDocId(doc.id);
          setReference(doc.reference);
          setSelectedProjectId(doc.projectId);
          setSelectedTemplateId(
            doc.templateId || OFFICIAL_TEXAWAVE_MOM_TEMPLATE.id,
          );
          setTemplateVersion(
            doc.templateVersion || OFFICIAL_TEXAWAVE_MOM_TEMPLATE.version,
          );
          setTemplateTitle(
            doc.templateTitle ||
              doc.templateSnapshot?.name ||
              "Standard Template",
          );
          setTemplateSnapshot(
            doc.templateSnapshot || OFFICIAL_TEXAWAVE_MOM_TEMPLATE,
          );

          setMeetingTitle(doc.meetingTitle);
          setMeetingDate(doc.meetingDate || "");
          setStartTime(doc.startTime || "10:00");
          setEndTime(doc.endTime || "11:00");
          setTimezone(doc.timezone || "IST (UTC+05:30)");
          setLocation(doc.location || "");
          setAttendees(doc.attendees || []);
          setAbsentees(doc.absentees || []);
          setAgenda(doc.agenda || []);
          setMeetingNotes(doc.meetingNotes || []);
          setCurrentStatus(doc.status);
          setCurrentRevision(doc.currentRevision || 1);
          setWorkingRevision(doc.workingRevision);
          setWorkingRevisionReason(doc.workingRevisionReason);
          setVersionToken(doc.versionToken || 1);
        } else {
          // New creation mode
          const preselectedProjId = searchParams.get("projectId");
          if (preselectedProjId) {
            setSelectedProjectId(preselectedProjId);
          } else if (allProjects && allProjects.length > 0) {
            setSelectedProjectId(allProjects[0].id);
          }

          const defaultTmpl =
            allTemplates.find((t) => t.isDefault && t.status === "active") ||
            allTemplates[0] ||
            OFFICIAL_TEXAWAVE_MOM_TEMPLATE;
          setSelectedTemplateId(defaultTmpl.id);
          setTemplateVersion(defaultTmpl.version);
          setTemplateTitle(defaultTmpl.name);
          setTemplateSnapshot(JSON.parse(JSON.stringify(defaultTmpl)));
          if (defaultTmpl.defaultAgenda)
            setAgenda(JSON.parse(JSON.stringify(defaultTmpl.defaultAgenda)));
          if (defaultTmpl.defaultNoteRows)
            setMeetingNotes(
              JSON.parse(JSON.stringify(defaultTmpl.defaultNoteRows)),
            );
        }
      } catch (err: any) {
        console.error("Failed to load MoM editor:", err);
        setLoadError(err?.message || "Failed to load document");
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [id, searchParams, user]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeTemplates = templates.filter((t) => t.status === "active");

  // Field change wrappers marking form dirty
  const handleTemplateChange = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;

    setSelectedTemplateId(tmpl.id);
    setTemplateVersion(tmpl.version);
    setTemplateTitle(tmpl.name);
    setTemplateSnapshot(JSON.parse(JSON.stringify(tmpl)));

    if (tmpl.defaultAgenda && tmpl.defaultAgenda.length > 0) {
      setAgenda(JSON.parse(JSON.stringify(tmpl.defaultAgenda)));
    }
    if (tmpl.defaultNoteRows && tmpl.defaultNoteRows.length > 0) {
      setMeetingNotes(JSON.parse(JSON.stringify(tmpl.defaultNoteRows)));
    }
    setIsDirty(true);
    toast.success(`Applied template "${tmpl.name}" (${tmpl.version})`);
  };

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleSave = async (isFinalize: boolean) => {
    const payload: Partial<MomDocument> = {
      id: docId,
      projectId: selectedProjectId,
      templateId: selectedTemplateId,
      templateTitle,
      templateVersion,
      templateSnapshot,
      meetingTitle,
      meetingDate,
      startTime,
      endTime,
      timezone,
      location,
      attendees,
      absentees,
      agenda,
      meetingNotes,
      status: isFinalize ? "finalized" : "draft",
      versionToken,
    };

    // Validation
    if (isFinalize) {
      const validation = validateMomFinalize(payload);
      if (!validation.isValid) {
        toast.error(
          validation.errors[0] ||
            "Please complete all required meeting fields.",
        );
        return;
      }
    } else {
      const validation = validateMomDraft(payload);
      if (!validation.isValid) {
        toast.error(
          validation.errors[0] || "Please provide Project and Meeting Title.",
        );
        return;
      }
    }

    setSaving(true);
    try {
      let savedDoc: MomDocument;

      if (isFinalize && docId) {
        // Use finalizeMom to properly handle working revision promotion & revision logging
        const summaryText =
          changeSummary.trim() ||
          (workingRevisionReason
            ? `Finalized revision ${workingRevision || currentRevision}: ${workingRevisionReason}`
            : "Finalized meeting document");
        savedDoc = await finalizeMom(docId, payload, user, summaryText);
      } else {
        const summaryText =
          changeSummary.trim() ||
          (isFinalize ? "Finalized meeting document" : "Saved draft updates");
        savedDoc = await saveMom(payload, user, isFinalize, summaryText);
      }

      setIsDirty(false);
      setChangeSummary("");
      setDocId(savedDoc.id);
      setReference(savedDoc.reference);
      setCurrentStatus(savedDoc.status);
      setCurrentRevision(savedDoc.currentRevision);
      setWorkingRevision(savedDoc.workingRevision);
      setWorkingRevisionReason(savedDoc.workingRevisionReason);
      setVersionToken(savedDoc.versionToken);
      setFullDocument(savedDoc);

      toast.success(
        isFinalize
          ? `Meeting Minutes ${savedDoc.reference} (Rev ${savedDoc.currentRevision}) finalized successfully!`
          : `Draft ${savedDoc.reference} saved successfully!`,
      );

      navigate("/projects/mom");
    } catch (err: any) {
      console.error("Error saving MoM:", err);
      toast.error(
        err?.message ||
          "Failed to save meeting record. Your changes are preserved locally.",
      );
      if (err instanceof StaleSaveConflictError) {
        setConflictDoc(err.remoteDoc);
        toast.error(
          "Remote conflict: Another user made changes while you were editing.",
        );
      } else {
        toast.error(
          err?.message ||
            "Failed to save meeting record. Your changes are preserved locally.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStartRevision = async () => {
    if (!docId) return;
    if (!revisionReasonInput.trim()) {
      toast.error("Please provide a reason for creating a new revision.");
      return;
    }

    setSaving(true);
    try {
      const updated = await startWorkingRevision(
        docId,
        user,
        revisionReasonInput.trim(),
      );
      setRevisionModalOpen(false);
      setRevisionReasonInput("");
      setFullDocument(updated);
      setCurrentStatus(updated.status);
      setWorkingRevision(updated.workingRevision);
      setWorkingRevisionReason(updated.workingRevisionReason);
      setVersionToken(updated.versionToken);
      toast.success(`Working revision ${updated.workingRevision} initialized.`);
      navigate(`/projects/mom/${docId}/edit`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create working revision.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!docId) return;
    if (
      !confirm(
        `Are you sure you want to archive MoM ${reference}? It will remain accessible in history.`,
      )
    )
      return;

    setSaving(true);
    try {
      const updated = await archiveMom(docId, user);
      setFullDocument(updated);
      setCurrentStatus(updated.status);
      setVersionToken(updated.versionToken);
      toast.success(`Meeting minutes ${reference} archived.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive document.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!docId) return;
    setSaving(true);
    try {
      const updated = await restoreMom(docId, user);
      setFullDocument(updated);
      setCurrentStatus(updated.status);
      setVersionToken(updated.versionToken);
      toast.success(
        `Meeting minutes ${reference} restored to ${updated.status}.`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore document.");
    } finally {
      setSaving(false);
    }
  };

  // Preview Object
  const currentDocForPreview: MomDocument = {
    id: docId || "temp-id",
    reference: reference || "MOM-DRAFT",
    projectId: selectedProjectId,
    projectCode: selectedProject?.projectCode || "PRJ",
    projectName: selectedProject?.name || "Project",
    clientName: selectedProject?.customerName || selectedProject?.client || "",
    meetingTitle,
    meetingDate,
    startTime,
    endTime,
    timezone,
    location,
    attendees,
    absentees,
    agenda,
    meetingNotes,
    status: currentStatus,
    templateId: selectedTemplateId,
    templateTitle,
    templateVersion,
    templateSnapshot,
    currentRevision,
    revisions: [],
    history: [],
    createdAt: new Date().toISOString(),
    createdBy: (user as any)?.id || user?.username || "user",
    createdByName: user?.name || "User",
    updatedAt: new Date().toISOString(),
    updatedBy: (user as any)?.id || user?.username || "user",
    updatedByName: user?.name || "User",
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-xs font-bold text-muted-foreground">
          Loading meeting document...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-foreground">
          Access Restricted or Error
        </h2>
        <p className="text-xs text-muted-foreground">{loadError}</p>
        <Button
          onClick={() => navigate("/projects/mom")}
          style={{
            background:
              "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
          }}
          className="text-white font-bold rounded-xl text-xs"
        >
          Return to MoM Register
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Step Flow Progress Bar (Create / Edit Mode) */}
      {!isReadOnly && (
        <div className="bg-card p-3 rounded-2xl border border-border flex items-center justify-between text-xs text-muted-foreground overflow-x-auto">
          <div className="flex items-center gap-2 font-medium shrink-0">
            <span
              className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${selectedProjectId ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
            >
              1
            </span>
            <span
              className={selectedProjectId ? "font-bold text-foreground" : ""}
            >
              Select Project
            </span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <div className="flex items-center gap-2 font-medium shrink-0">
            <span
              className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${selectedTemplateId ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
            >
              2
            </span>
            <span
              className={selectedTemplateId ? "font-bold text-foreground" : ""}
            >
              Apply Template
            </span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <div className="flex items-center gap-2 font-medium shrink-0">
            <span
              className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${meetingTitle ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
            >
              3
            </span>
            <span className="font-bold text-foreground">Enter Content</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <div className="flex items-center gap-2 font-medium shrink-0">
            <span className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
              4
            </span>
            <span>Save Draft</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <div className="flex items-center gap-2 font-medium shrink-0">
            <span
              className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${currentStatus === "finalized" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
            >
              5
            </span>
            <span
              className={
                currentStatus === "finalized"
                  ? "font-bold text-emerald-700"
                  : ""
              }
            >
              Preview & Finalize
            </span>
          </div>
        </div>
      )}

      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                isDirty &&
                !confirm(
                  "You have unsaved changes. Are you sure you want to exit?",
                )
              )
                return;
              navigate("/projects/mom");
            }}
            className="rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Register
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              {reference}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold px-2 py-0.5 border ${
                currentStatus === "finalized"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : currentStatus === "archived"
                    ? "bg-gray-100 text-gray-700 border-gray-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
              }`}
            >
              {currentStatus.toUpperCase()}
            </Badge>
            <span className="text-[11px] font-mono font-semibold text-slate-500">
              Rev {currentRevision}
            </span>
            {isDirty && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                Unsaved Changes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {/* History Button */}
          {docId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHistoryModalOpen(true)}
              className="rounded-xl text-xs font-bold h-9 bg-card border-border hover:bg-muted"
            >
              <History className="h-3.5 w-3.5 mr-1 text-primary" />
              History & Revisions
            </Button>
          )}

          {/* Preview & PDF */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="rounded-xl text-xs font-bold h-9 bg-card border-border hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            Preview & PDF
          </Button>

          {/* If document is Archived, show Restore button */}
          {currentStatus === "archived" && (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleRestore}
              className="rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white h-9"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore Document
            </Button>
          )}

          {/* If document is Finalized and viewing/read-only */}
          {currentStatus === "finalized" && isReadOnly && (
            <>
              {hasMomPermission(
                user,
                "create_revision",
                fullDocument,
                selectedProject,
              ) && (
                <Button
                  size="sm"
                  onClick={() => setRevisionModalOpen(true)}
                  style={{
                    background:
                      "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                  className="rounded-xl text-xs font-bold text-white shadow-xs h-9"
                >
                  <GitBranch className="h-3.5 w-3.5 mr-1" /> Create Revision
                </Button>
              )}
              {hasMomPermission(
                user,
                "archive",
                fullDocument,
                selectedProject,
              ) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  className="rounded-xl text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 h-9"
                >
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                </Button>
              )}
            </>
          )}

          {/* Draft view mode: Allow direct editing if authorized */}
          {currentStatus === "draft" && isReadOnly && (
            <Button
              size="sm"
              onClick={() => navigate(`/projects/mom/${docId}/edit`)}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="rounded-xl text-xs font-bold text-white shadow-xs h-9"
            >
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit Draft
            </Button>
          )}

          {/* Edit / Create Mode Action Buttons */}
          {!isReadOnly && currentStatus !== "archived" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="rounded-xl text-xs font-bold h-9 bg-card border-border hover:bg-muted"
              >
                <Save className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => handleSave(true)}
                style={{
                  background:
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
                className="rounded-xl text-xs font-bold text-white shadow-xs h-9"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {saving
                  ? "Finalizing..."
                  : workingRevision
                    ? `Finalize Rev ${workingRevision}`
                    : "Finalize MoM"}
              </Button>
              {docId &&
                hasMomPermission(
                  user,
                  "archive",
                  fullDocument,
                  selectedProject,
                ) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleArchive}
                    className="rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-9"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                )}
            </>
          )}
        </div>
      </div>

      {/* Main Document Layout Sheet */}
      <div className="bg-card shadow-lg rounded-3xl border border-border overflow-hidden">
        {/* Top Brand Accent Gradient */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
          }}
          className="h-2 w-full"
        />

        <div className="p-6 sm:p-10 space-y-8">
          {/* 1. Official Company Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-border gap-4">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {DEFAULT_MOM_COMPANY_HEADER.companyName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Email:{" "}
                <span className="font-semibold text-foreground">
                  {DEFAULT_MOM_COMPANY_HEADER.email}
                </span>{" "}
                • Phone:{" "}
                <span className="font-semibold text-foreground">
                  {DEFAULT_MOM_COMPANY_HEADER.phone}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {DEFAULT_MOM_COMPANY_HEADER.address}
              </p>
            </div>
            <div className="shrink-0">
              <img
                src={DEFAULT_MOM_COMPANY_HEADER.logoUrl}
                alt="TexaWave Logo"
                className="h-14 object-contain max-w-[160px]"
              />
            </div>
          </div>

          {/* Document Title Banner & Template Version Label */}
          <div className="text-center py-2 space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary font-mono">
              OFFICIAL MINUTES OF MEETING
            </span>
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span>
                Template:{" "}
                <strong className="text-foreground">{templateTitle}</strong> (
                {templateVersion})
              </span>
              <span>•</span>
              <span>
                Document Revision:{" "}
                <strong className="text-foreground">
                  Rev {currentRevision}
                </strong>
              </span>
            </div>

            <div className="mt-3 max-w-xl mx-auto">
              {isReadOnly ? (
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  {meetingTitle}
                </h1>
              ) : (
                <Input
                  value={meetingTitle}
                  onChange={(e) => {
                    setMeetingTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder="Enter Meeting Title *"
                  className="text-center text-lg sm:text-xl font-black h-11 rounded-xl"
                />
              )}
            </div>
          </div>

          {/* 2. Meeting Control Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
            {/* Project Selection */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary" /> Linked Project *
              </Label>
              {isReadOnly ? (
                <p className="font-bold text-foreground">
                  {selectedProject?.name || "Project"} (
                  {selectedProject?.projectCode || "PRJ"})
                </p>
              ) : (
                <Select
                  value={selectedProjectId}
                  onValueChange={(val) => {
                    setSelectedProjectId(val);
                    markDirty();
                  }}
                >
                  <SelectTrigger className="text-xs h-8 bg-card">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectCode ? `[${p.projectCode}] ` : ""}
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Template Selection */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" /> Apply Template
              </Label>
              {!isReadOnly && mode === "create" ? (
                <Select
                  value={selectedTemplateId}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger className="text-xs h-8 bg-card">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-bold text-foreground">
                  {templateTitle} ({templateVersion})
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" /> Meeting Date *
              </Label>
              {isReadOnly ? (
                <p className="font-bold text-foreground">
                  {meetingDate || "—"}
                </p>
              ) : (
                <Input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => {
                    setMeetingDate(e.target.value);
                    markDirty();
                  }}
                  className="text-xs h-8 bg-card"
                />
              )}
            </div>

            {/* Time */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" /> Time & Timezone
              </Label>
              {isReadOnly ? (
                <p className="font-bold text-foreground">
                  {startTime} - {endTime} ({timezone})
                </p>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      markDirty();
                    }}
                    className="text-xs h-8 bg-card w-24"
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      markDirty();
                    }}
                    className="text-xs h-8 bg-card w-24"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" /> Location / Link
              </Label>
              {isReadOnly ? (
                <p className="font-bold text-foreground truncate">
                  {location || "Online"}
                </p>
              ) : (
                <Input
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    markDirty();
                  }}
                  placeholder="Meeting Room or Virtual Link"
                  className="text-xs h-8 bg-card"
                />
              )}
            </div>
          </div>

          {/* 3. Attendees & Absentees */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              Meeting Attendance
            </h3>
            <AttendeeListManager
              attendees={attendees}
              absentees={absentees}
              onChangeAttendees={(atts) => {
                setAttendees(atts);
                markDirty();
              }}
              onChangeAbsentees={(abss) => {
                setAbsentees(abss);
                markDirty();
              }}
              disabled={isReadOnly}
            />
          </div>

          {/* 4. Numbered Agenda */}
          <div className="space-y-3 pt-2">
            <AgendaListManager
              agenda={agenda}
              onChange={(ag) => {
                setAgenda(ag);
                markDirty();
              }}
              disabled={isReadOnly}
            />
          </div>

          {/* 5. Meeting Notes & Deliberations Table */}
          <div className="space-y-3 pt-2">
            <MeetingNotesTable
              rows={meetingNotes}
              onChange={(rows) => {
                setMeetingNotes(rows);
                markDirty();
              }}
              disabled={isReadOnly}
            />
          </div>

          {/* Optional revision summary input for edit mode */}
          {!isReadOnly && mode === "edit" && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" /> Summary of
                Changes (Optional)
              </Label>
              <Input
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Updated action items for Sprint 2 milestone"
                className="text-xs h-8 bg-card"
              />
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <MomPreviewModal
        document={currentDocForPreview}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* Revision History & Audit Trail Modal */}
      <MomRevisionHistoryModal
        document={fullDocument || currentDocForPreview}
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
      />

      {/* Create Revision Prompt Dialog */}
      <Dialog open={revisionModalOpen} onOpenChange={setRevisionModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader className="space-y-1 pb-2 border-b border-border">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Create Document Revision
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Finalized corporate minutes cannot be directly edited. This will
              unlock a working revision ({currentRevision + 1}) while retaining
              official Revision {currentRevision} intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">
                Reason for Revision <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={revisionReasonInput}
                onChange={(e) => setRevisionReasonInput(e.target.value)}
                placeholder="e.g. Corrected action item owners and updated milestone deliverable dates"
                className="text-xs"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                This revision reason is recorded in the permanent document
                history audit trail.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevisionModalOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !revisionReasonInput.trim()}
              onClick={handleStartRevision}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="rounded-xl text-xs font-bold text-white shadow-xs"
            >
              <GitBranch className="h-3.5 w-3.5 mr-1" />
              {saving ? "Creating..." : `Start Revision ${currentRevision + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stale Save Conflict Dialog */}
      <Dialog
        open={Boolean(conflictDoc)}
        onOpenChange={(o) => !o && setConflictDoc(null)}
      >
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader className="space-y-1 pb-2 border-b border-border">
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Concurrent Update Detected
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This document was updated remotely by{" "}
              <strong>{conflictDoc?.updatedByName || "another user"}</strong> at{" "}
              {conflictDoc
                ? new Date(conflictDoc.updatedAt).toLocaleTimeString()
                : ""}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs text-muted-foreground space-y-2">
            <p>
              To prevent accidental lost updates, your save was halted. Your
              current inputs remain intact in the editor.
            </p>
            <p className="font-semibold text-foreground">
              You can overwrite the server copy with your version or reload the
              remote document to inspect the latest edits.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (conflictDoc) {
                  setVersionToken(conflictDoc.versionToken);
                  setConflictDoc(null);
                  toast.info(
                    "Acknowledged remote version token. You may now save to overwrite.",
                  );
                }
              }}
              className="rounded-xl text-xs font-bold"
            >
              Keep My Version (Allow Overwrite)
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => window.location.reload()}
              className="rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground"
            >
              Reload Remote Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
