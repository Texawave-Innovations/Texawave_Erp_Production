import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { database } from "@/services/firebase";
import {
  ProposalDocument,
  ProposalTemplate,
  ProposalSectionConfig,
  ProposalStatus,
  ProposalSettings,
  DEFAULT_PROPOSAL_SETTINGS,
  ProposalActivity,
  UserProposalRole,
  hasProposalPermission,
} from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtendFollowupModal } from "./ExtendFollowupModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Download,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  User,
  Hash,
  Layers,
  Plus,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Loader2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  History,
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Printer,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Split,
  Layout,
  PanelLeft,
  Check,
  RefreshCw,
  Copy,
} from "lucide-react";
import html2pdf from "html2pdf.js";
import { toast } from "sonner";

export default function ProposalEditor() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<ProposalDocument | null>(null);
  const [settings, setSettings] = useState<ProposalSettings>(
    DEFAULT_PROPOSAL_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeRole, setActiveRole] = useState<UserProposalRole>("admin");

  // Workflow Dialog State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    targetStatus: ProposalStatus;
    actionLabel: string;
    title: string;
    description: string;
    requireComment?: boolean;
    commentLabel?: string;
    commentPlaceholder?: string;
    btnColor?: string;
  } | null>(null);
  const [workflowComment, setWorkflowComment] = useState("");
  const [actorName, setActorName] = useState("Current User");
  const [actorRole, setActorRole] = useState("Project Lead");

  // Editable Document Metadata
  const [title, setTitle] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [proposalDate, setProposalDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProposalStatus>("draft");

  // Dynamic Section Values State
  // Format: { [sectionId]: value }
  const [sectionValues, setSectionValues] = useState<Record<string, any>>({});

  // Dynamic Section Order / Extended Cloned Sections State
  const [dynamicSections, setDynamicSections] = useState<
    ProposalSectionConfig[]
  >([]);

  // PHASE 13: Usability Enhancements States
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [timeAgoText, setTimeAgoText] = useState<string>("All changes saved");
  const [previewMode, setPreviewMode] = useState<
    "split" | "editor_only" | "preview_only"
  >("split");
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 75, 100, 125
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Sync scroll to corresponding section in live preview pane
  const scrollToPreviewSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const targetElement = document.getElementById(
      `preview-section-${sectionId}`,
    );
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Delete Confirmation Dialog State
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Extend Follow-up Due Date Modal State
  const [extendModalOpen, setExtendModalOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch global proposal settings for branding
    const unsubSettings = onValue(
      ref(database, "proposal_settings"),
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_PROPOSAL_SETTINGS, ...snap.val() });
        }
      },
    );

    if (!proposalId) return;

    const unsub = onValue(
      ref(database, `proposal_documents/${proposalId}`),
      (snap) => {
        if (!snap.exists()) {
          setProposal(null);
          setLoading(false);
          return;
        }

        const doc: ProposalDocument = {
          id: proposalId,
          ...snap.val(),
        };

        setProposal(doc);
        setTitle(doc.title || "");
        setProposalNumber(doc.proposalNumber || "");
        setClientName(doc.clientName || "");
        setProjectName(doc.projectName || "");
        setPreparedBy(doc.preparedBy || "");
        setProposalDate(
          doc.proposalDate ||
            doc.createdAt?.split("T")[0] ||
            new Date().toISOString().split("T")[0],
        );
        setDueDate(doc.dueDate || doc.due_date || "");
        setStatus(doc.status || "draft");

        // Initialize default values from templateSnapshot if not already filled
        const existingValues = doc.sectionValues || {};
        const initialValues: Record<string, any> = { ...existingValues };

        const snapshotSections: ProposalSectionConfig[] =
          doc.templateSnapshot?.sections || [];
        snapshotSections.forEach((sec) => {
          if (initialValues[sec.id] === undefined) {
            if (
              sec.contentType === "rich_text" ||
              sec.contentType === "paragraph" ||
              sec.contentType === "short_text" ||
              sec.contentType === "long_text"
            ) {
              initialValues[sec.id] = sec.defaultContent || "";
            } else if (
              sec.contentType === "bullet_list" ||
              sec.contentType === "numbered_list"
            ) {
              initialValues[sec.id] =
                sec.defaultItems && sec.defaultItems.length > 0
                  ? [...sec.defaultItems]
                  : [""];
            } else if (sec.contentType === "key_value") {
              const kvMap: Record<string, string> = {};
              sec.keyValueFields?.forEach((f) => {
                kvMap[f.id] = f.defaultValue || "";
              });
              initialValues[sec.id] = kvMap;
            } else if (sec.contentType === "table") {
              initialValues[sec.id] = [];
            } else if (sec.contentType === "section_group") {
              const subMap: Record<string, any> = {};
              sec.subsections?.forEach((sub) => {
                if (
                  sub.contentType === "bullet_list" ||
                  sub.contentType === "numbered_list"
                ) {
                  subMap[sub.id] =
                    sub.defaultItems && sub.defaultItems.length > 0
                      ? [...sub.defaultItems]
                      : [""];
                } else {
                  subMap[sub.id] = sub.defaultContent || "";
                }
              });
              initialValues[sec.id] = subMap;
            } else if (sec.contentType === "signature") {
              const sigMap: Record<string, string> = {};
              sec.signatureFields?.forEach((f) => {
                sigMap[f.id] = "";
              });
              initialValues[sec.id] = sigMap;
            }
          }
        });

        setDynamicSections(snapshotSections);
        setSectionValues(initialValues);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [proposalId]);

  // Update time-ago text every 5 seconds for autosave indicator
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastSavedTime) {
        setTimeAgoText("All changes saved");
        return;
      }
      const secondsAgo = Math.max(
        0,
        Math.floor((Date.now() - lastSavedTime.getTime()) / 1000),
      );
      if (secondsAgo < 5) {
        setTimeAgoText("Saved just now");
      } else if (secondsAgo < 60) {
        setTimeAgoText(`Saved ${secondsAgo} seconds ago`);
      } else {
        const mins = Math.floor(secondsAgo / 60);
        setTimeAgoText(`Saved ${mins} minute${mins > 1 ? "s" : ""} ago`);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [lastSavedTime]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    title,
    proposalNumber,
    clientName,
    projectName,
    preparedBy,
    proposalDate,
    status,
    sectionValues,
    dynamicSections,
  ]);

  // Autosave: debounced 2.5s after user edits
  useEffect(() => {
    if (!isDirty || !proposalId) return;

    const handler = setTimeout(() => {
      handleSave(undefined, true); // silent autosave
    }, 2500);

    return () => clearTimeout(handler);
  }, [sectionValues, title, clientName, projectName, preparedBy, isDirty]);

  // Section Values Handlers (Marks dirty for autosave)
  const markDirty = () => {
    setIsDirty(true);
  };

  // Section Values Handlers
  const handleTextChange = (sectionId: string, val: string) => {
    setSectionValues((prev) => ({ ...prev, [sectionId]: val }));
  };

  // Bullet / Numbered List Item Change
  const handleListItemChange = (
    sectionId: string,
    idx: number,
    val: string,
  ) => {
    setSectionValues((prev) => {
      const list = [...(prev[sectionId] || [""])];
      list[idx] = val;
      return { ...prev, [sectionId]: list };
    });
  };

  const handleAddListItem = (sectionId: string) => {
    setSectionValues((prev) => {
      const list = [...(prev[sectionId] || [])];
      list.push("");
      return { ...prev, [sectionId]: list };
    });
  };

  const handleDeleteListItem = (sectionId: string, idx: number) => {
    setSectionValues((prev) => {
      const list = [...(prev[sectionId] || [])];
      list.splice(idx, 1);
      return { ...prev, [sectionId]: list.length > 0 ? list : [""] };
    });
  };

  // Key-Value Pair Field Change
  const handleKeyValueChange = (
    sectionId: string,
    fieldId: string,
    val: string,
  ) => {
    setSectionValues((prev) => {
      const kvMap = { ...(prev[sectionId] || {}) };
      kvMap[fieldId] = val;
      return { ...prev, [sectionId]: kvMap };
    });
  };

  // Table Row Add / Edit / Delete
  const handleAddTableRow = (sectionId: string, columns: any[]) => {
    setSectionValues((prev) => {
      const rows = [...(prev[sectionId] || [])];
      const emptyRow: Record<string, string> = {};
      columns.forEach((col) => {
        emptyRow[col.id] = "";
      });
      rows.push(emptyRow);
      return { ...prev, [sectionId]: rows };
    });
  };

  const handleTableCellChange = (
    sectionId: string,
    rowIdx: number,
    colId: string,
    val: string,
  ) => {
    setSectionValues((prev) => {
      const rows = [...(prev[sectionId] || [])];
      if (!rows[rowIdx]) rows[rowIdx] = {};
      rows[rowIdx] = { ...rows[rowIdx], [colId]: val };
      return { ...prev, [sectionId]: rows };
    });
  };

  const handleDeleteTableRow = (sectionId: string, rowIdx: number) => {
    setSectionValues((prev) => {
      const rows = [...(prev[sectionId] || [])];
      rows.splice(rowIdx, 1);
      return { ...prev, [sectionId]: rows };
    });
  };

  // Subsection change within Section Group
  const handleSubsectionChange = (
    sectionId: string,
    subsectionId: string,
    val: any,
  ) => {
    setSectionValues((prev) => {
      const groupMap = { ...(prev[sectionId] || {}) };
      groupMap[subsectionId] = val;
      return { ...prev, [sectionId]: groupMap };
    });
  };

  // Save changes to Firebase (Supports silent autosave & manual save)
  const handleSave = async (newStatus?: ProposalStatus, isAutoSave = false) => {
    if (!proposalId) return;
    if (!isAutoSave) setSaving(true);

    try {
      const targetStatus = newStatus || status;
      const now = new Date().toISOString();

      const updatedPayload: any = {
        title,
        proposal_number: proposalNumber,
        proposalNumber,
        client_name: clientName,
        clientName,
        project_name: projectName,
        projectName,
        preparedBy,
        proposalDate,
        dueDate: dueDate || "",
        due_date: dueDate || "",
        status: targetStatus,
        proposal_data: sectionValues, // Dynamic JSON map of section field values
        sectionValues,
        templateSnapshot: {
          ...(proposal?.templateSnapshot || {}),
          sections: dynamicSections,
        },
        updated_at: now,
        updatedAt: now,
      };

      // If status changed directly, record default activity
      if (newStatus && newStatus !== status) {
        const existingActivities: ProposalActivity[] = Array.isArray(
          proposal?.activities,
        )
          ? proposal.activities
          : typeof proposal?.activities === "object" &&
              proposal?.activities !== null
            ? Object.values(proposal.activities)
            : [];

        const newAct: ProposalActivity = {
          id: `act_${Date.now()}`,
          user: actorName || preparedBy || "Arun",
          userName: actorName || preparedBy || "Arun",
          userRole: actorRole,
          action: `Status updated to ${newStatus.replace("_", " ")}`,
          previousStatus: status,
          newStatus,
          timestamp: now,
        };
        updatedPayload.activities = [...existingActivities, newAct];
      }

      await update(
        ref(database, `proposal_documents/${proposalId}`),
        updatedPayload,
      );

      setStatus(targetStatus);
      setIsDirty(false);
      setLastSavedTime(new Date());

      if (!isAutoSave) {
        toast.success(
          targetStatus === "under_review"
            ? "Proposal submitted for internal review!"
            : "Proposal saved successfully!",
        );
        navigate("/projects/proposals");
      }
    } catch (err: any) {
      if (!isAutoSave) {
        toast.error(err?.message || "Failed to save proposal");
      }
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  // Section duplication (Allowed only where template configuration permits it: sec.allowDuplicate !== false)
  const handleDuplicateSection = (index: number) => {
    const target = dynamicSections[index];
    if (!target) return;

    const newId = `sec_dup_${Date.now()}`;
    const duplicated: ProposalSectionConfig = {
      ...target,
      id: newId,
      title: `${target.title} (Copy)`,
      order: index + 1,
    };

    const newSections = [...dynamicSections];
    newSections.splice(index + 1, 0, duplicated);

    // Deep clone section value for duplicate
    const currentVal = sectionValues[target.id];
    const clonedVal = currentVal
      ? JSON.parse(JSON.stringify(currentVal))
      : undefined;

    setDynamicSections(newSections.map((s, idx) => ({ ...s, order: idx })));
    setSectionValues((prev) => ({ ...prev, [newId]: clonedVal }));
    setIsDirty(true);
    toast.success(`Duplicated section "${target.title}"`);
  };

  // Safe delete with populated content confirmation
  const requestDeleteSection = (index: number) => {
    const target = dynamicSections[index];
    if (!target) return;

    const val = sectionValues[target.id];
    const hasContent =
      val &&
      (typeof val === "string"
        ? val.trim().length > 0
        : Array.isArray(val)
          ? val.some((v) =>
              typeof v === "string"
                ? v.trim().length > 0
                : Object.values(v || {}).some(Boolean),
            )
          : typeof val === "object"
            ? Object.values(val).some(Boolean)
            : false);

    if (hasContent) {
      setDeleteConfirmDialog({
        open: true,
        title: `Delete populated section "${target.title}"?`,
        description: `This section contains active filled content. Deleting it will permanently remove its text and structured data.`,
        onConfirm: () => {
          const newSections = dynamicSections.filter((_, idx) => idx !== index);
          setDynamicSections(
            newSections.map((s, idx) => ({ ...s, order: idx })),
          );
          setIsDirty(true);
          setDeleteConfirmDialog((prev) => ({ ...prev, open: false }));
          toast.success(`Deleted section "${target.title}"`);
        },
      });
    } else {
      const newSections = dynamicSections.filter((_, idx) => idx !== index);
      setDynamicSections(newSections.map((s, idx) => ({ ...s, order: idx })));
      setIsDirty(true);
      toast.success(`Deleted section "${target.title}"`);
    }
  };

  // Safe delete table row with content confirmation
  const requestDeleteTableRow = (sectionId: string, rowIdx: number) => {
    const rows = sectionValues[sectionId] || [];
    const targetRow = rows[rowIdx] || {};
    const hasRowContent = Object.values(targetRow).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );

    if (hasRowContent) {
      setDeleteConfirmDialog({
        open: true,
        title: "Delete table row with content?",
        description:
          "This table row contains entered data. Are you sure you want to remove it?",
        onConfirm: () => {
          handleDeleteTableRow(sectionId, rowIdx);
          setDeleteConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    } else {
      handleDeleteTableRow(sectionId, rowIdx);
    }
  };

  // Safe delete list item with content confirmation
  const requestDeleteListItem = (sectionId: string, idx: number) => {
    const list = sectionValues[sectionId] || [];
    const item = list[idx] || "";
    if (item && item.trim().length > 0) {
      setDeleteConfirmDialog({
        open: true,
        title: "Delete list item?",
        description: `Are you sure you want to remove "${item}"?`,
        onConfirm: () => {
          handleDeleteListItem(sectionId, idx);
          setDeleteConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    } else {
      handleDeleteListItem(sectionId, idx);
    }
  };

  // Open Workflow confirmation modal
  const openWorkflowModal = (
    targetStatus: ProposalStatus,
    actionLabel: string,
    title: string,
    description: string,
    requireComment = false,
    btnColor = "bg-emerald-600 hover:bg-emerald-700",
    commentLabel?: string,
    commentPlaceholder?: string,
  ) => {
    setPendingAction({
      targetStatus,
      actionLabel,
      title,
      description,
      requireComment,
      commentLabel,
      commentPlaceholder,
      btnColor,
    });
    setWorkflowComment("");
    setActionModalOpen(true);
  };

  // Confirm and execute Workflow transition with audit history
  const handleConfirmWorkflow = async () => {
    if (!proposalId || !pendingAction) return;

    if (pendingAction.requireComment && !workflowComment.trim()) {
      toast.error(
        pendingAction.targetStatus === "rejected"
          ? "Please enter the reason why the proposal was rejected."
          : "Please enter review comments or justification.",
      );
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existingActivities: ProposalActivity[] = Array.isArray(
        proposal?.activities,
      )
        ? proposal.activities
        : typeof proposal?.activities === "object" &&
            proposal?.activities !== null
          ? Object.values(proposal.activities)
          : [];

      const newAct: ProposalActivity = {
        id: `act_${Date.now()}`,
        user: actorName || preparedBy || "User",
        userName: actorName || preparedBy || "User",
        userRole: actorRole,
        action: pendingAction.actionLabel,
        previousStatus: status,
        newStatus: pendingAction.targetStatus,
        timestamp: now,
        comments: workflowComment.trim() || undefined,
      };

      const updatedActivities = [...existingActivities, newAct];

      await update(ref(database, `proposal_documents/${proposalId}`), {
        title,
        proposal_number: proposalNumber,
        proposalNumber,
        client_name: clientName,
        clientName,
        project_name: projectName,
        projectName,
        preparedBy,
        proposalDate,
        status: pendingAction.targetStatus,
        proposal_data: sectionValues,
        sectionValues,
        activities: updatedActivities,
        updated_at: now,
        updatedAt: now,
      });

      setStatus(pendingAction.targetStatus);
      setActionModalOpen(false);
      toast.success(
        `Proposal status updated to "${pendingAction.targetStatus.replace("_", " ").toUpperCase()}"!`,
      );
      navigate("/projects/proposals");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update proposal workflow state");
    } finally {
      setSaving(false);
    }
  };

  const [generatingPdf, setGeneratingPdf] = useState(false);

  // High-Fidelity PDF Generation matching Live Preview perfectly
  const handleGeneratePDF = async () => {
    const element = document.getElementById("printable-proposal-document");
    if (!element) {
      toast.error("Could not locate printable proposal sheet.");
      return;
    }

    setGeneratingPdf(true);
    const toastId = toast.loading("Generating professional A4 PDF...");

    try {
      // Clean filename format: ProposalNumber_Client_Project.pdf
      const safePropNum = (proposalNumber || "TXW-PROP-2026-001")
        .replace(/[/\\?%*:|"<>]/g, "-")
        .trim();
      const safeClient = (clientName || "Client")
        .replace(/[/\\?%*:|"<> ]/g, "-")
        .trim();
      const safeProject = (projectName || "Project")
        .replace(/[/\\?%*:|"<> ]/g, "-")
        .trim();
      const filename = `${safePropNum}_${safeClient}_${safeProject}.pdf`;

      const opt = {
        margin: [10, 10, 12, 10], // top, left, bottom, right in mm
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2, // Crisp 300dpi-equivalent resolution
          useCORS: true,
          logging: false,
          scrollY: 0,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: {
          mode: ["avoid-all", "css", "legacy"],
          before: ".pdf-page-break-before",
          after: ".pdf-page-break-after",
        },
      };

      await (html2pdf as any)().set(opt).from(element).save();
      toast.success(`Generated ${filename}`, { id: toastId });
    } catch (err: any) {
      toast.error(
        err?.message ||
          "Failed to generate PDF. Falling back to browser print...",
        { id: toastId },
      );
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading
        proposal editor...
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-20 space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="text-sm font-bold text-slate-700">
          Proposal document not found
        </p>
        <Button
          onClick={() => navigate("/projects/proposals")}
          style={{
            background:
              "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
          }}
          className="text-white font-bold rounded-2xl text-xs"
        >
          Return to Proposals Hub
        </Button>
      </div>
    );
  }

  const templateSnapshot = proposal.templateSnapshot;
  const sections: ProposalSectionConfig[] =
    dynamicSections.length > 0
      ? dynamicSections
      : templateSnapshot?.sections || [];

  // PHASE 13: Proposal Completion & Validation Calculations
  const validationIssues: string[] = [];
  if (!clientName.trim()) validationIssues.push("Client Name is empty");
  if (!title.trim()) validationIssues.push("Proposal Title is empty");
  if (!proposalDate) validationIssues.push("Proposal Date is missing");

  // Check each section requirement and table row requirements
  let totalTrackedFields = 3; // title, client, date
  let completedFields = 0;
  if (title.trim()) completedFields++;
  if (clientName.trim()) completedFields++;
  if (proposalDate) completedFields++;

  sections.forEach((sec) => {
    if (sec.contentType === "page_break" || sec.contentType === "spacer")
      return;

    totalTrackedFields++;
    const val = sectionValues[sec.id];
    let isFilled = false;

    if (
      sec.contentType === "rich_text" ||
      sec.contentType === "paragraph" ||
      sec.contentType === "short_text" ||
      sec.contentType === "long_text"
    ) {
      isFilled = typeof val === "string" && val.trim().length > 0;
    } else if (
      sec.contentType === "bullet_list" ||
      sec.contentType === "numbered_list"
    ) {
      isFilled =
        Array.isArray(val) &&
        val.some((it) => typeof it === "string" && it.trim().length > 0);
      if (sec.isRequired && (!val || val.length === 0 || !isFilled)) {
        validationIssues.push(
          `Required section "${sec.title}" has no list items`,
        );
      }
    } else if (sec.contentType === "table") {
      isFilled =
        Array.isArray(val) &&
        val.length > 0 &&
        val.some((r) => Object.values(r || {}).some(Boolean));
      if (sec.isRequired && (!val || val.length === 0)) {
        validationIssues.push(
          `Required table "${sec.title}" has no rows entered`,
        );
      }
    } else if (sec.contentType === "key_value") {
      isFilled =
        val && typeof val === "object" && Object.values(val).some(Boolean);
      if (sec.isRequired && !isFilled) {
        validationIssues.push(
          `Required key-values in "${sec.title}" are incomplete`,
        );
      }
    } else if (sec.contentType === "section_group") {
      isFilled =
        val && typeof val === "object" && Object.values(val).some(Boolean);
    } else if (sec.contentType === "signature") {
      isFilled =
        val && typeof val === "object" && Object.values(val).some(Boolean);
    } else {
      isFilled = Boolean(val);
    }

    if (sec.isRequired && !isFilled) {
      validationIssues.push(
        `Required section "${sec.title}" is missing content`,
      );
    }

    if (isFilled) completedFields++;
  });

  const completionPercentage =
    totalTrackedFields > 0
      ? Math.min(100, Math.round((completedFields / totalTrackedFields) * 100))
      : 100;

  // Toggle collapsible section
  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Toolbar */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-6 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/projects/proposals")}
              className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs font-black px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-xl text-emerald-100 border border-white/20">
              {proposalNumber}
            </span>
            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold uppercase">
              {status.replace("_", " ")}
            </Badge>
            <Badge className="bg-emerald-900/40 text-emerald-100 border-emerald-400/30 text-xs font-semibold">
              Template: {proposal.templateTitle || "Master Template"} (
              {proposal.templateVersion || "V1"})
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {title || "Untitled Proposal"}
          </h1>
          <p className="text-emerald-100/90 text-xs pl-1">
            Client:{" "}
            <strong className="text-white">
              {clientName || "General Client"}
            </strong>{" "}
            • Associated Project:{" "}
            <strong className="text-white">
              {projectName || "Independent"}
            </strong>
          </p>
        </div>

        {/* Action Toolbar with RBAC Role Context */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Active Role Selector */}
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/25 text-xs text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            <span className="font-bold text-[10px]">Role:</span>
            <select
              value={activeRole}
              onChange={(e) => {
                const r = e.target.value as UserProposalRole;
                setActiveRole(r);
                setActorRole(
                  r === "admin"
                    ? "System Admin"
                    : r === "manager"
                      ? "Reviewer / Manager"
                      : "Author / Engineer",
                );
                toast.info(`Switched active view to ${r.toUpperCase()}`);
              }}
              className="bg-emerald-950/40 text-white font-bold text-xs rounded-xl px-1.5 py-0.5 border border-white/20 focus:outline-none cursor-pointer"
            >
              <option value="admin" className="text-slate-900 bg-white">
                Admin
              </option>
              <option value="manager" className="text-slate-900 bg-white">
                Manager / Reviewer
              </option>
              <option value="employee" className="text-slate-900 bg-white">
                Employee
              </option>
            </select>
          </div>

          {/* 1. Save Draft (available in draft or changes_requested) */}
          {hasProposalPermission(activeRole, "edit_proposal") &&
            (status === "draft" || status === "changes_requested") && (
              <Button
                variant="outline"
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-bold rounded-2xl shadow-sm px-3.5 py-2.5 h-auto text-xs"
              >
                <Save className="h-4 w-4 mr-1.5 text-white" /> Save Draft
              </Button>
            )}

          {/* 2. Submit for Review (from Draft or Changes Requested) */}
          {hasProposalPermission(activeRole, "submit_for_review") &&
            (status === "draft" || status === "changes_requested") && (
              <Button
                onClick={() =>
                  openWorkflowModal(
                    "under_review",
                    "Submitted for Review",
                    "Submit Proposal for Internal Review",
                    "Send this technical and commercial proposal to managers and engineering leads for review.",
                  )
                }
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs"
              >
                <Send className="h-4 w-4 mr-1.5 text-white" /> Submit for Review
              </Button>
            )}

          {/* 3. Under Review Actions: Approve or Request Changes (Manager / Admin Only) */}
          {status === "under_review" &&
            hasProposalPermission(activeRole, "review_proposal") && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    openWorkflowModal(
                      "changes_requested",
                      "Requested Changes",
                      "Request Proposal Changes",
                      "Specify required modifications before this proposal can be approved.",
                      true,
                      "bg-orange-600 hover:bg-orange-700",
                    )
                  }
                  disabled={saving}
                  className="bg-orange-500/80 hover:bg-orange-500 text-white border-white/20 font-bold rounded-2xl shadow-sm px-3.5 py-2.5 h-auto text-xs"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5 text-white" /> Request
                  Changes
                </Button>

                <Button
                  onClick={() =>
                    openWorkflowModal(
                      "approved",
                      "Approved by Reviewer",
                      "Approve Proposal Document",
                      "Approve this proposal as commercially and technically verified.",
                    )
                  }
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5 text-white" /> Approve
                  Proposal
                </Button>
              </>
            )}

          {/* 4. Approved State Action: Send to Client (Manager / Admin Only) */}
          {status === "approved" &&
            hasProposalPermission(activeRole, "send_to_client") && (
              <Button
                onClick={() =>
                  openWorkflowModal(
                    "sent",
                    "Proposal Sent to Client",
                    "Mark as Sent to Client",
                    "Record that this proposal was dispatched and delivered to the client.",
                  )
                }
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs"
              >
                <Send className="h-4 w-4 mr-1.5 text-white" /> Mark Sent to
                Client
              </Button>
            )}

          {/* 5. Sent State Actions: Client Accepted or Rejected */}
          {status === "sent" && (
            <>
              <Button
                onClick={() =>
                  openWorkflowModal(
                    "accepted",
                    "Client Accepted Proposal",
                    "Mark as Accepted by Client",
                    "Record client acceptance of this proposal. Document any updates, agreed terms, PO number, or remarks below.",
                    false,
                    "bg-emerald-600 hover:bg-emerald-700",
                    "Reason / Any Updates",
                    "Enter any updates, agreed adjustments, client PO reference, milestone schedules, or confirmation notes...",
                  )
                }
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs transition-all hover:scale-[1.02]"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-white" /> Mark
                Accepted
              </Button>
              <Button
                onClick={() =>
                  openWorkflowModal(
                    "rejected",
                    "Client Rejected Proposal",
                    "Mark as Rejected by Client",
                    "Record that the client did not approve this proposal. Please specify the reason why it was rejected.",
                    true,
                    "bg-rose-600 hover:bg-rose-700",
                    "Reason why Rejected",
                    "Please specify the reason why the client rejected this proposal (e.g., budget exceeded, project postponed, chosen competitor)...",
                  )
                }
                disabled={saving}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs transition-all hover:scale-[1.02]"
              >
                <XCircle className="h-4 w-4 mr-1.5 text-white" /> Mark Rejected
              </Button>
            </>
          )}

          {/* PDF Generation (Always Available) */}
          <Button
            onClick={handleGeneratePDF}
            disabled={generatingPdf}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl shadow-md px-4 py-2.5 h-auto text-xs transition-all hover:scale-[1.02]"
            title={`Exports ${proposalNumber || "Proposal"}.pdf`}
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-emerald-700" />
            ) : (
              <Download className="h-4 w-4 mr-1.5 text-emerald-700" />
            )}
            Generate PDF
          </Button>
        </div>
      </div>

      {/* PHASE 13: Usability & Status Control Bar (Autosave, Validation, Completion, View Modes, Zoom) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Autosave & Unsaved Changes Status + Completion Score */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Autosave Ticker */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            {isDirty ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                <span className="text-amber-700">Unsaved changes...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-slate-600">{timeAgoText}</span>
              </>
            )}
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              (Ctrl+S)
            </span>
          </div>

          {/* Proposal Completion Indicator */}
          <div className="flex items-center gap-2.5 bg-emerald-50/70 border border-emerald-200/80 px-3.5 py-1.5 rounded-xl text-xs">
            <span className="font-bold text-emerald-950 text-[11px]">
              Completion:
            </span>
            <div className="w-24 h-2 bg-emerald-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="font-mono font-black text-emerald-800 text-xs">
              {completionPercentage}%
            </span>
          </div>
        </div>

        {/* Right: Preview Mode (Editor + Preview / Editor Only / Preview Only) & Zoom Controls */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* View Mode Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setPreviewMode("split")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all text-xs ${
                previewMode === "split"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Split className="h-3.5 w-3.5" /> Editor + Preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("editor_only")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all text-xs ${
                previewMode === "editor_only"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" /> Editor Only
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("preview_only")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all text-xs ${
                previewMode === "preview_only"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layout className="h-3.5 w-3.5" /> Preview Only
            </button>
          </div>

          {/* Zoom Level Controls (for Live Preview Sheet) */}
          {(previewMode === "split" || previewMode === "preview_only") && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel(75)}
                className={`px-2 py-0.5 rounded-md font-bold text-xs ${zoomLevel === 75 ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500"}`}
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className={`px-2 py-0.5 rounded-md font-bold text-xs ${zoomLevel === 100 ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500"}`}
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(125)}
                className={`px-2 py-0.5 rounded-md font-bold text-xs ${zoomLevel === 125 ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500"}`}
              >
                125%
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Validation Issue Alert Banner (Shows when missing required fields or empty client) */}
      {validationIssues.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="font-bold">
              Required Details & Content Check ({validationIssues.length} item
              {validationIssues.length > 1 ? "s" : ""} remaining):
            </p>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-amber-800">
              {validationIssues.map((issue, idx) => (
                <span
                  key={idx}
                  className="bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 font-medium"
                >
                  • {issue}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Split Screen Desktop Layout with Dynamic View Modes (45% Editor, 55% Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Proposal Editor (Independently Scrollable with Synchronized Preview Scroll) */}
        <div
          id="proposal-editor-scroll-container"
          className={`space-y-6 ${
            previewMode === "editor_only"
              ? "lg:col-span-12"
              : previewMode === "preview_only"
                ? "hidden"
                : "lg:col-span-5"
          } lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-2 scroll-smooth focus-within:scroll-auto`}
        >
          {/* Document General Properties Card */}
          <Card
            id="editor-section-doc-info"
            onClick={() => scrollToPreviewSection("doc-header")}
            className={`border shadow-md rounded-3xl bg-white overflow-hidden transition-all duration-300 ${
              activeSectionId === "doc-header"
                ? "border-emerald-500 ring-2 ring-emerald-400/30"
                : "border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-5 bg-slate-50/60 border-b border-slate-100">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" /> Document
                Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Proposal Title
                </label>
                <Input
                  value={title}
                  onFocus={() => scrollToPreviewSection("doc-header")}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl text-xs h-9"
                  placeholder="Enter proposal title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Proposal Number
                  </label>
                  <Input
                    value={proposalNumber}
                    onFocus={() => scrollToPreviewSection("doc-header")}
                    onChange={(e) => setProposalNumber(e.target.value)}
                    className="rounded-xl text-xs font-mono font-bold h-9 bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Proposal Date
                  </label>
                  <Input
                    type="date"
                    value={proposalDate}
                    onFocus={() => scrollToPreviewSection("doc-header")}
                    onChange={(e) => setProposalDate(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Client Name
                  </label>
                  <Input
                    value={clientName}
                    onFocus={() => scrollToPreviewSection("doc-header")}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      markDirty();
                    }}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Prepared By
                  </label>
                  <Input
                    value={preparedBy}
                    onFocus={() => scrollToPreviewSection("doc-header")}
                    onChange={(e) => {
                      setPreparedBy(e.target.value);
                      markDirty();
                    }}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              {/* Follow-up Due Date Field */}
              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" /> Client
                    Follow-up Due Date
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExtendModalOpen(true)}
                      className="h-6 px-2 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-md"
                    >
                      <Calendar className="h-3 w-3 mr-1 text-emerald-600" />
                      Extend Date
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dueDate}
                    readOnly
                    onClick={() => setExtendModalOpen(true)}
                    className="rounded-xl text-xs h-9 bg-white border-amber-200 text-slate-800 cursor-pointer"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setExtendModalOpen(true)}
                    style={{
                      background:
                        "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                    className="rounded-xl text-xs font-bold text-white h-9 px-3 shrink-0"
                  >
                    Extend
                  </Button>
                </div>
                {proposal?.followUpNotes && (
                  <p className="text-[10px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                    Latest note: "{proposal.followUpNotes}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Template Sections Editor */}
          {sections.map((sec, secIdx) => {
            const secVal = sectionValues[sec.id];
            const sectionNum =
              sec.showSectionNumber !== false ? `${secIdx + 1}.0 ` : "";
            const isCollapsed = Boolean(collapsedSections[sec.id]);
            const isActive = activeSectionId === sec.id;

            return (
              <Card
                key={sec.id}
                id={`editor-section-${sec.id}`}
                onClick={() => scrollToPreviewSection(sec.id)}
                className={`border shadow-md rounded-3xl bg-white overflow-hidden transition-all duration-300 ${
                  isActive
                    ? "border-emerald-500 ring-2 ring-emerald-400/30"
                    : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <CardHeader className="p-4 sm:p-5 bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionCollapse(sec.id);
                      scrollToPreviewSection(sec.id);
                    }}
                    className="cursor-pointer flex items-center gap-2 flex-1 select-none"
                  >
                    <button
                      type="button"
                      className="h-6 w-6 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center shrink-0"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <div>
                      <CardTitle className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-700 font-mono">
                          {sectionNum}
                        </span>
                        {sec.title}
                        {sec.isRequired && (
                          <span
                            className="text-rose-500 font-bold"
                            title="Required section"
                          >
                            *
                          </span>
                        )}
                      </CardTitle>
                      {sec.description && (
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {sec.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[9.5px] font-semibold text-slate-500 bg-white"
                    >
                      {sec.contentType.replace("_", " ")}
                    </Badge>

                    {/* Section Duplication (Enabled by default unless explicitly disabled) */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSection(secIdx);
                      }}
                      className="h-7 w-7 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                      title="Duplicate Section"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    {/* Section Delete with Populated Content Confirmation */}
                    {sec.allowUserDelete !== false && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteSection(secIdx);
                        }}
                        className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete Section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="p-5 space-y-4">
                    {/* 1. RICH TEXT / PARAGRAPH / SHORT / LONG TEXT */}
                    {sec.contentType === "rich_text" ||
                    sec.contentType === "paragraph" ||
                    sec.contentType === "long_text" ? (
                      <div className="space-y-2">
                        {/* Rich Text Toolbar simulator */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-slate-600">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Bold"
                          >
                            <Bold className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Italic"
                          >
                            <Italic className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Underline"
                          >
                            <Underline className="h-3.5 w-3.5" />
                          </button>
                          <div className="h-3.5 w-[1px] bg-slate-300 mx-1" />
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Bullet List"
                          >
                            <List className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Numbered List"
                          >
                            <ListOrdered className="h-3.5 w-3.5" />
                          </button>
                          <div className="h-3.5 w-[1px] bg-slate-300 mx-1" />
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Align Left"
                          >
                            <AlignLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Align Center"
                          >
                            <AlignCenter className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-white"
                            title="Link"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Textarea
                          rows={5}
                          value={secVal || ""}
                          onFocus={() => scrollToPreviewSection(sec.id)}
                          onChange={(e) =>
                            handleTextChange(sec.id, e.target.value)
                          }
                          placeholder={
                            sec.placeholder ||
                            "Enter detailed section content..."
                          }
                          className="text-xs rounded-xl leading-relaxed"
                        />
                      </div>
                    ) : sec.contentType === "short_text" ? (
                      <Input
                        value={secVal || ""}
                        onFocus={() => scrollToPreviewSection(sec.id)}
                        onChange={(e) =>
                          handleTextChange(sec.id, e.target.value)
                        }
                        placeholder={sec.placeholder || "Enter short text..."}
                        className="rounded-xl text-xs h-9"
                      />
                    ) : sec.contentType === "bullet_list" ||
                      sec.contentType === "numbered_list" ? (
                      /* 2. BULLET & NUMBERED LIST */
                      <div className="space-y-2.5">
                        {(Array.isArray(secVal) ? secVal : [""]).map(
                          (item: string, iIdx: number) => (
                            <div key={iIdx} className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono text-xs w-4 text-center shrink-0">
                                {sec.contentType === "numbered_list"
                                  ? `${iIdx + 1}.`
                                  : "•"}
                              </span>
                              <Input
                                value={item}
                                onFocus={() => scrollToPreviewSection(sec.id)}
                                onChange={(e) =>
                                  handleListItemChange(
                                    sec.id,
                                    iIdx,
                                    e.target.value,
                                  )
                                }
                                placeholder={`Enter item #${iIdx + 1}`}
                                className="rounded-xl text-xs h-9 flex-1"
                              />
                              {sec.allowDeleteRow !== false && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestDeleteListItem(sec.id, iIdx)
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  title="Delete Item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ),
                        )}

                        {sec.allowAddRow !== false && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleAddListItem(sec.id);
                              scrollToPreviewSection(sec.id);
                            }}
                            className="rounded-xl text-xs h-8 border-dashed border-slate-300 w-full text-slate-600"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" />{" "}
                            Add Item
                          </Button>
                        )}
                      </div>
                    ) : sec.contentType === "key_value" ? (
                      /* 3. KEY-VALUE FIELDS */
                      <div className="space-y-3">
                        {(
                          sec.keyValueFields || [
                            { id: "f1", label: "Project Title", type: "text" },
                            { id: "f2", label: "PRD Code", type: "text" },
                            { id: "f3", label: "Client", type: "text" },
                            { id: "f4", label: "Version", type: "text" },
                            { id: "f5", label: "Prepared By", type: "text" },
                            { id: "f6", label: "Reviewed By", type: "text" },
                            { id: "f7", label: "Approved By", type: "text" },
                            { id: "f8", label: "Date", type: "date" },
                          ]
                        ).map((field) => {
                          const fieldVal = (secVal && secVal[field.id]) || "";
                          return (
                            <div key={field.id} className="space-y-1">
                              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span>
                                  {field.label}{" "}
                                  {field.required && (
                                    <span className="text-rose-500">*</span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase font-mono">
                                  {field.type}
                                </span>
                              </label>
                              <Input
                                type={
                                  field.type === "date"
                                    ? "date"
                                    : field.type === "number"
                                      ? "number"
                                      : "text"
                                }
                                value={fieldVal}
                                onFocus={() => scrollToPreviewSection(sec.id)}
                                onChange={(e) =>
                                  handleKeyValueChange(
                                    sec.id,
                                    field.id,
                                    e.target.value,
                                  )
                                }
                                placeholder={
                                  field.placeholder || `Enter ${field.label}`
                                }
                                className="rounded-xl text-xs h-9"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : sec.contentType === "table" ? (
                      /* 4. DYNAMIC TABLE */
                      <div className="space-y-3">
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                {(sec.tableColumns &&
                                sec.tableColumns.length > 0
                                  ? sec.tableColumns
                                  : [
                                      {
                                        id: "col1",
                                        name: "Milestone",
                                        type: "text",
                                      },
                                      {
                                        id: "col2",
                                        name: "Duration",
                                        type: "text",
                                      },
                                      {
                                        id: "col3",
                                        name: "End Date",
                                        type: "date",
                                      },
                                    ]
                                ).map((col) => (
                                  <th
                                    key={col.id}
                                    className="py-2 px-3 text-left"
                                  >
                                    {col.name}
                                  </th>
                                ))}
                                <th className="py-2 px-2 w-10 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {(Array.isArray(secVal) && secVal.length > 0
                                ? secVal
                                : []
                              ).map((row: any, rIdx: number) => (
                                <tr key={rIdx}>
                                  {(sec.tableColumns &&
                                  sec.tableColumns.length > 0
                                    ? sec.tableColumns
                                    : [
                                        {
                                          id: "col1",
                                          name: "Milestone",
                                          type: "text",
                                        },
                                        {
                                          id: "col2",
                                          name: "Duration",
                                          type: "text",
                                        },
                                        {
                                          id: "col3",
                                          name: "End Date",
                                          type: "date",
                                        },
                                      ]
                                  ).map((col) => (
                                    <td key={col.id} className="p-1.5">
                                      <Input
                                        type={
                                          col.type === "date" ? "date" : "text"
                                        }
                                        value={row[col.id] || ""}
                                        onFocus={() =>
                                          scrollToPreviewSection(sec.id)
                                        }
                                        onChange={(e) =>
                                          handleTableCellChange(
                                            sec.id,
                                            rIdx,
                                            col.id,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={col.name}
                                        className="h-8 text-xs rounded-lg border-slate-200"
                                      />
                                    </td>
                                  ))}
                                  <td className="p-1.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        requestDeleteTableRow(sec.id, rIdx)
                                      }
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      title="Delete Row"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleAddTableRow(
                              sec.id,
                              sec.tableColumns || [
                                { id: "col1", name: "Milestone", type: "text" },
                                { id: "col2", name: "Duration", type: "text" },
                                { id: "col3", name: "End Date", type: "date" },
                              ],
                            );
                            scrollToPreviewSection(sec.id);
                          }}
                          className="rounded-xl text-xs h-8 border-dashed border-slate-300 w-full text-slate-600"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" />{" "}
                          Add Table Row
                        </Button>
                      </div>
                    ) : sec.contentType === "section_group" ? (
                      /* 5. SECTION GROUP (SUBSECTIONS) */
                      <div className="space-y-4">
                        {(
                          sec.subsections || [
                            {
                              id: "sub1",
                              title: "In Scope",
                              contentType: "bullet_list",
                            },
                            {
                              id: "sub2",
                              title: "Out of Scope",
                              contentType: "bullet_list",
                            },
                          ]
                        ).map((sub, sIdx) => {
                          const subVal = secVal ? secVal[sub.id] : undefined;
                          return (
                            <div
                              key={sub.id}
                              className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5"
                            >
                              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <span className="text-emerald-700 font-mono">{`${secIdx + 1}.${sIdx + 1}`}</span>
                                {sub.title}
                              </h4>

                              {sub.contentType === "bullet_list" ||
                              sub.contentType === "numbered_list" ? (
                                <div className="space-y-2">
                                  {(Array.isArray(subVal) ? subVal : [""]).map(
                                    (item: string, iIdx: number) => (
                                      <div
                                        key={iIdx}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="text-slate-400 font-mono text-xs w-3 text-center">
                                          •
                                        </span>
                                        <Input
                                          value={item}
                                          onFocus={() =>
                                            scrollToPreviewSection(sec.id)
                                          }
                                          onChange={(e) => {
                                            const list = [
                                              ...(Array.isArray(subVal)
                                                ? subVal
                                                : [""]),
                                            ];
                                            list[iIdx] = e.target.value;
                                            handleSubsectionChange(
                                              sec.id,
                                              sub.id,
                                              list,
                                            );
                                          }}
                                          placeholder={`Enter ${sub.title} item`}
                                          className="rounded-xl text-xs h-8 flex-1 bg-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const list = [
                                              ...(Array.isArray(subVal)
                                                ? subVal
                                                : [""]),
                                            ];
                                            list.splice(iIdx, 1);
                                            handleSubsectionChange(
                                              sec.id,
                                              sub.id,
                                              list.length > 0 ? list : [""],
                                            );
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ),
                                  )}

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const list = [
                                        ...(Array.isArray(subVal)
                                          ? subVal
                                          : []),
                                      ];
                                      list.push("");
                                      handleSubsectionChange(
                                        sec.id,
                                        sub.id,
                                        list,
                                      );
                                      scrollToPreviewSection(sec.id);
                                    }}
                                    className="rounded-xl text-[11px] h-7 border-dashed border-slate-300 w-full text-slate-600 bg-white"
                                  >
                                    <Plus className="h-3 w-3 mr-1 text-emerald-600" />{" "}
                                    Add {sub.title} Item
                                  </Button>
                                </div>
                              ) : (
                                <Textarea
                                  rows={3}
                                  value={subVal || ""}
                                  onFocus={() => scrollToPreviewSection(sec.id)}
                                  onChange={(e) =>
                                    handleSubsectionChange(
                                      sec.id,
                                      sub.id,
                                      e.target.value,
                                    )
                                  }
                                  placeholder={`Enter ${sub.title} content...`}
                                  className="text-xs rounded-xl bg-white"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : sec.contentType === "signature" ? (
                      /* 6. SIGNATURE CONFIG */
                      <div className="space-y-3">
                        {(
                          sec.signatureFields || [
                            {
                              id: "sig1",
                              label: "Authorized Signatory Name",
                              type: "name",
                            },
                            {
                              id: "sig2",
                              label: "Designation / Role",
                              type: "role",
                            },
                          ]
                        ).map((f) => (
                          <div key={f.id} className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">
                              {f.label}
                            </label>
                            <Input
                              value={(secVal && secVal[f.id]) || ""}
                              onFocus={() => scrollToPreviewSection(sec.id)}
                              onChange={(e) => {
                                const sigMap = { ...(secVal || {}) };
                                sigMap[f.id] = e.target.value;
                                setSectionValues((prev) => ({
                                  ...prev,
                                  [sec.id]: sigMap,
                                }));
                              }}
                              placeholder={`Enter ${f.label}`}
                              className="rounded-xl text-xs h-9"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Static or layout section.
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {/* PHASE 9: Workflow Activity History Audit Trail Card */}
          <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
            <CardHeader className="p-5 bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" /> Proposal
                  Workflow History
                </CardTitle>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Complete chronological audit trail of all state transitions
                  and review comments.
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-white text-slate-700"
              >
                {proposal.activities?.length || 1} Logged Events
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {(Array.isArray(proposal.activities) &&
                proposal.activities.length > 0
                  ? proposal.activities
                  : [
                      {
                        id: "initial",
                        user: proposal.preparedBy || "Arun",
                        action: `Proposal created by ${proposal.preparedBy || "Author"}`,
                        newStatus: "draft" as ProposalStatus,
                        timestamp:
                          proposal.createdAt || new Date().toISOString(),
                        comments:
                          "Initial draft initialized from master template snapshot.",
                      },
                    ]
                )
                  .slice()
                  .reverse()
                  .map((act, aIdx) => {
                    const actDate = act.timestamp
                      ? new Date(act.timestamp)
                      : new Date();
                    const formattedTime =
                      actDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }) +
                      " " +
                      actDate.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                    const isLatest = aIdx === 0;

                    return (
                      <div key={act.id || aIdx} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                            act.newStatus === "approved" ||
                            act.newStatus === "accepted"
                              ? "bg-emerald-500 ring-2 ring-emerald-200"
                              : act.newStatus === "under_review"
                                ? "bg-amber-500 ring-2 ring-amber-200"
                                : act.newStatus === "sent"
                                  ? "bg-blue-500 ring-2 ring-blue-200"
                                  : act.newStatus === "changes_requested"
                                    ? "bg-orange-500 ring-2 ring-orange-200"
                                    : act.newStatus === "rejected"
                                      ? "bg-rose-500 ring-2 ring-rose-200"
                                      : "bg-slate-400"
                          }`}
                        />

                        <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/70 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-[10.5px] font-bold text-slate-800">
                              {formattedTime}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase font-bold ${
                                act.newStatus === "approved" ||
                                act.newStatus === "accepted"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : act.newStatus === "under_review"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : act.newStatus === "sent"
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : act.newStatus === "changes_requested"
                                        ? "bg-orange-50 text-orange-800 border-orange-200"
                                        : act.newStatus === "rejected"
                                          ? "bg-rose-50 text-rose-800 border-rose-200"
                                          : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {act.newStatus.replace("_", " ")}
                            </Badge>
                          </div>

                          <p className="text-xs font-bold text-slate-900">
                            {act.action}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>
                              Actor:{" "}
                              <strong className="text-slate-700">
                                {act.user || act.userName || "User"}
                              </strong>{" "}
                              {act.userRole && `(${act.userRole})`}
                            </span>
                          </p>

                          {act.comments && (
                            <div className="mt-1.5 p-2 bg-white rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="italic">"{act.comments}"</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDE: Live Proposal Preview (Independently Scrollable with Synchronized Focus Highlight) */}
        <div
          className={`${previewMode === "preview_only" ? "lg:col-span-12" : previewMode === "editor_only" ? "hidden" : "lg:col-span-7"} sticky top-4`}
        >
          <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200/80 flex flex-col shadow-inner">
            {/* Top Preview Bar (Static Header) */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-800">
                  Real-Time A4 Document Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-white text-[10px] font-mono"
                >
                  {proposalNumber} • Page 1 of{" "}
                  {Math.max(
                    1,
                    sections.filter((s) => s.contentType === "page_break")
                      .length + 1,
                  )}
                </Badge>
                <span className="text-[11px] text-slate-400 font-medium">
                  Zoom: {zoomLevel}%
                </span>
              </div>
            </div>

            {/* Scrollable Preview Viewport */}
            <div
              id="proposal-preview-scroll-container"
              className="max-h-[calc(100vh-210px)] overflow-y-auto overflow-x-auto scroll-smooth pr-1"
            >
              {/* A4 Document Simulation Sheet with Zoom Scale */}
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.2s ease-in-out",
                }}
                className="w-full pb-8"
              >
                <div
                  id="printable-proposal-document"
                  className="bg-white shadow-2xl rounded-2xl border border-slate-300 p-8 sm:p-12 flex-1 flex flex-col space-y-8 max-w-3xl mx-auto w-full relative overflow-hidden text-black"
                >
                  {/* Document Header Accent */}
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                    className="h-2 w-full absolute top-0 left-0 right-0"
                  />

                  {/* Document Header matching Official Clean Specification */}
                  <div
                    id="preview-section-doc-header"
                    className={`relative pb-5 border-b border-slate-300 rounded-xl transition-all duration-300 ${
                      activeSectionId === "doc-header"
                        ? "bg-emerald-50/50 p-3 ring-2 ring-emerald-400/40"
                        : ""
                    }`}
                  >
                    {/* Center: Company Name & Proposal Title */}
                    <div className="text-center px-24 space-y-1">
                      {settings.showHeaderCompanyName && (
                        <p className="text-lg font-serif text-black font-bold tracking-normal">
                          {settings.companyName ||
                            "TexaWave Innovations Pvt Ltd"}
                        </p>
                      )}
                      {settings.showHeaderDocTitle && (
                        <h1 className="text-xl sm:text-2xl font-serif font-black text-black tracking-tight">
                          {title || "Client Proposal & Statement of Work"}
                        </h1>
                      )}
                    </div>

                    {/* Right Aligned Official Logo */}
                    {settings.showHeaderLogo && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end">
                        <img
                          src={settings.logoUrl || "/Texa_Logo.jpeg"}
                          alt="Logo"
                          className="h-16 object-contain max-w-[170px]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Document Sections Rendered Live */}
                  <div className="space-y-6 flex-1 text-xs leading-relaxed text-black">
                    {sections.map((sec, secIdx) => {
                      const secVal = sectionValues[sec.id];
                      const sectionNum =
                        sec.showSectionNumber !== false
                          ? `${secIdx + 1}.0 `
                          : "";
                      const isPreviewActive = activeSectionId === sec.id;

                      if (sec.contentType === "page_break") {
                        return (
                          <div
                            key={sec.id}
                            id={`preview-section-${sec.id}`}
                            className="py-4 my-2 border-y border-dashed border-emerald-400 bg-emerald-50/50 text-center text-xs font-mono text-emerald-800 flex items-center justify-center gap-2 rounded-lg pdf-page-break-before"
                            style={{ pageBreakBefore: "always" }}
                          >
                            <span className="print:hidden">
                              ✂ ─── PAGE BREAK (PDF Page {secIdx + 2}) ───
                            </span>
                          </div>
                        );
                      }

                      const shouldBreakBefore = sec.pageBreakBefore;

                      return (
                        <div
                          key={sec.id}
                          id={`preview-section-${sec.id}`}
                          className={`space-y-2 rounded-xl transition-all duration-300 p-2 ${
                            isPreviewActive
                              ? "bg-emerald-50/60 ring-2 ring-emerald-400/40 shadow-xs"
                              : ""
                          } ${shouldBreakBefore ? "pdf-page-break-before pt-6" : ""}`}
                          style={
                            shouldBreakBefore
                              ? { pageBreakBefore: "always" }
                              : {}
                          }
                        >
                          {/* Section Title */}
                          <div className="border-b border-slate-300 pb-1 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-1.5">
                              <span className="text-emerald-700 font-bold">
                                {sectionNum}
                              </span>
                              {sec.title}
                            </h3>
                          </div>

                          {/* Section Content */}
                          <div className="text-black pl-1">
                            {sec.contentType === "rich_text" ||
                            sec.contentType === "paragraph" ||
                            sec.contentType === "long_text" ? (
                              <p className="whitespace-pre-line leading-relaxed text-black">
                                {secVal ||
                                  sec.defaultContent ||
                                  "No text content provided yet."}
                              </p>
                            ) : sec.contentType === "short_text" ? (
                              <p className="font-bold text-black">
                                {secVal || "-"}
                              </p>
                            ) : sec.contentType === "bullet_list" ? (
                              <ul className="list-disc pl-5 space-y-1 text-black">
                                {(Array.isArray(secVal) && secVal.length > 0
                                  ? secVal
                                  : sec.defaultItems || []
                                ).map((it: string, i: number) => (
                                  <li key={i}>{it || "[Empty item]"}</li>
                                ))}
                              </ul>
                            ) : sec.contentType === "numbered_list" ? (
                              <ol className="list-decimal pl-5 space-y-1 text-black">
                                {(Array.isArray(secVal) && secVal.length > 0
                                  ? secVal
                                  : sec.defaultItems || []
                                ).map((it: string, i: number) => (
                                  <li key={i}>{it || "[Empty item]"}</li>
                                ))}
                              </ol>
                            ) : sec.contentType === "key_value" ? (
                              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs text-black">
                                {(
                                  sec.keyValueFields || [
                                    { id: "f1", label: "Project Title" },
                                    { id: "f2", label: "PRD Code" },
                                    { id: "f3", label: "Client" },
                                    { id: "f4", label: "Version" },
                                    { id: "f5", label: "Prepared By" },
                                    { id: "f6", label: "Reviewed By" },
                                    { id: "f7", label: "Approved By" },
                                    { id: "f8", label: "Date" },
                                  ]
                                ).map((f) => (
                                  <div key={f.id}>
                                    <span className="font-bold text-black">
                                      {f.label}:
                                    </span>{" "}
                                    <span className="text-black">
                                      {(secVal && secVal[f.id]) ||
                                        (f.id === "f1"
                                          ? title
                                          : f.id === "f3"
                                            ? clientName
                                            : f.id === "f5"
                                              ? preparedBy
                                              : "-")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : sec.contentType === "table" ? (
                              <div className="space-y-1.5 mt-1">
                                {sec.tableTitle && (
                                  <h4 className="text-xs font-bold text-black">
                                    {sec.tableTitle}
                                  </h4>
                                )}
                                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                                  <table className="w-full text-xs text-black">
                                    <thead className="bg-slate-100 text-black font-bold border-b border-slate-300">
                                      <tr>
                                        {(
                                          sec.tableColumns || [
                                            { id: "col1", name: "Milestone" },
                                            { id: "col2", name: "Duration" },
                                            { id: "col3", name: "End Date" },
                                          ]
                                        ).map((col) => (
                                          <th
                                            key={col.id}
                                            className="py-2 px-3 text-left font-bold text-black"
                                          >
                                            {col.name}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white text-black">
                                      {Array.isArray(secVal) &&
                                      secVal.length > 0 ? (
                                        secVal.map((row: any, rIdx: number) => (
                                          <tr key={rIdx}>
                                            {(
                                              sec.tableColumns || [
                                                {
                                                  id: "col1",
                                                  name: "Milestone",
                                                },
                                                {
                                                  id: "col2",
                                                  name: "Duration",
                                                },
                                                {
                                                  id: "col3",
                                                  name: "End Date",
                                                },
                                              ]
                                            ).map((col) => (
                                              <td
                                                key={col.id}
                                                className="py-2 px-3 text-black"
                                              >
                                                {row[col.id] || "-"}
                                              </td>
                                            ))}
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan={
                                              sec.tableColumns?.length || 3
                                            }
                                            className="py-3 px-3 text-center text-slate-500 italic"
                                          >
                                            No table rows entered.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : sec.contentType === "section_group" ? (
                              <div className="space-y-3 pt-1">
                                {(
                                  sec.subsections || [
                                    {
                                      id: "sub1",
                                      title: "In Scope",
                                      contentType: "bullet_list",
                                    },
                                    {
                                      id: "sub2",
                                      title: "Out of Scope",
                                      contentType: "bullet_list",
                                    },
                                  ]
                                ).map((sub, sIdx) => {
                                  const subVal = secVal
                                    ? secVal[sub.id]
                                    : undefined;
                                  return (
                                    <div
                                      key={sub.id}
                                      className="p-3 bg-slate-50/70 rounded-xl border border-slate-300 space-y-1.5 text-black"
                                    >
                                      <h4 className="text-xs font-bold text-black flex items-center gap-1.5">
                                        <span className="text-emerald-700 font-mono text-[11px] font-bold">{`${secIdx + 1}.${sIdx + 1}`}</span>
                                        {sub.title}
                                      </h4>
                                      {sub.contentType === "bullet_list" ||
                                      sub.contentType === "numbered_list" ? (
                                        <ul className="list-disc pl-5 space-y-1 text-black text-[11px]">
                                          {(Array.isArray(subVal) &&
                                          subVal.length > 0
                                            ? subVal
                                            : sub.defaultItems || []
                                          ).map((it: string, i: number) => (
                                            <li key={i}>
                                              {it || "[Empty item]"}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-[11px] text-black">
                                          {subVal || "No content."}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : sec.contentType === "signature" ? (
                              <div className="grid grid-cols-2 gap-6 pt-4 mt-2 border-t border-slate-300 text-black">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase text-black">
                                    Authorized Signatory (Provider)
                                  </p>
                                  <div className="h-12 border-b-2 border-slate-400 flex items-end pb-1 font-serif italic text-black font-bold">
                                    {settings.companyName ||
                                      "TexaWave Innovations"}{" "}
                                    Signatory
                                  </div>
                                  <p className="text-[10px] text-black">
                                    Prepared By:{" "}
                                    <strong className="text-black">
                                      {preparedBy || "Lead Engineer"}
                                    </strong>
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase text-black">
                                    Client Acceptance Authorization
                                  </p>
                                  <div className="h-12 border-b-2 border-slate-400 flex items-end pb-1 text-slate-400 text-[10px]">
                                    Sign Here / Official Seal
                                  </div>
                                  <p className="text-[10px] text-black">
                                    Authorized For:{" "}
                                    <strong className="text-black">
                                      {clientName || "Client Organization"}
                                    </strong>
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-black italic">
                                Dynamic block configured.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Document Footer */}
                  <div className="pt-4 mt-auto border-t border-slate-300 text-[9.5px] text-black space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-black">
                        {settings.showFooterEmail && (
                          <span>{settings.email}</span>
                        )}
                        {settings.showFooterPhone && (
                          <span>• {settings.phone}</span>
                        )}
                        {settings.showFooterWebsite && (
                          <span>• {settings.website}</span>
                        )}
                      </div>
                      {settings.showFooterPageNumber && (
                        <span className="font-semibold text-black">
                          Page 1 of 1
                        </span>
                      )}
                    </div>
                    {settings.showFooterAddress && (
                      <p className="text-[8.5px] text-black font-medium">
                        {settings.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PHASE 9: Workflow Transition Modal */}
          <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
            <DialogContent className="sm:max-w-md rounded-3xl border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {pendingAction?.targetStatus === "rejected" ? (
                    <XCircle className="h-5 w-5 text-rose-600" />
                  ) : pendingAction?.targetStatus === "accepted" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  )}
                  {pendingAction?.title || "Update Proposal Workflow"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {pendingAction?.description ||
                    "Confirm and record this proposal workflow transition in the audit history."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">
                      User / Actor
                    </label>
                    <Input
                      value={actorName}
                      onChange={(e) => setActorName(e.target.value)}
                      placeholder="e.g. Arun / Reviewer"
                      className="rounded-xl text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Role</label>
                    <Input
                      value={actorRole}
                      onChange={(e) => setActorRole(e.target.value)}
                      placeholder="e.g. Lead Engineer / Manager"
                      className="rounded-xl text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      {pendingAction?.commentLabel ||
                        "Comments / Review Feedback"}
                    </span>
                    {pendingAction?.requireComment && (
                      <span className="text-[10px] text-rose-500 font-bold">
                        * Required
                      </span>
                    )}
                  </label>
                  <Textarea
                    rows={3}
                    value={workflowComment}
                    onChange={(e) => setWorkflowComment(e.target.value)}
                    placeholder={
                      pendingAction?.commentPlaceholder ||
                      (pendingAction?.targetStatus === "changes_requested"
                        ? "Specify required modifications, missing deliverables, or commercial corrections..."
                        : "Optional note or approval sign-off remarks...")
                    }
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionModalOpen(false)}
                  className="rounded-xl text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmWorkflow}
                  disabled={saving}
                  className={`rounded-xl text-xs h-9 font-bold text-white ${pendingAction?.btnColor || "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : pendingAction?.targetStatus === "rejected" ? (
                    <XCircle className="h-4 w-4 mr-1.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  {pendingAction?.targetStatus === "rejected"
                    ? "Confirm Rejection"
                    : pendingAction?.targetStatus === "accepted"
                      ? "Confirm Acceptance"
                      : "Confirm & Transition"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* PHASE 13: Delete Populated Content Confirmation Dialog */}
          <Dialog
            open={deleteConfirmDialog.open}
            onOpenChange={(open) =>
              setDeleteConfirmDialog((prev) => ({ ...prev, open }))
            }
          >
            <DialogContent className="sm:max-w-md rounded-3xl border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-base font-black text-rose-600 tracking-tight flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  {deleteConfirmDialog.title || "Confirm Deletion"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 pt-1">
                  {deleteConfirmDialog.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDeleteConfirmDialog((prev) => ({ ...prev, open: false }))
                  }
                  className="rounded-xl text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={deleteConfirmDialog.onConfirm}
                  className="rounded-xl text-xs h-9 font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Confirm Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Extend Follow-up Due Date Modal */}
          {proposal && (
            <ExtendFollowupModal
              open={extendModalOpen}
              onClose={() => setExtendModalOpen(false)}
              proposal={proposal}
              currentDueDate={dueDate}
              onConfirm={async (newDate, reason) => {
                const oldDueDate =
                  dueDate || proposal.dueDate || proposal.due_date || "None";
                const oldFormatted =
                  oldDueDate !== "None"
                    ? new Date(oldDueDate).toLocaleDateString("en-GB")
                    : "None";
                const newFormatted = new Date(newDate).toLocaleDateString(
                  "en-GB",
                );

                const activity: any = {
                  id: `act_${Date.now()}`,
                  user: actorName || "Admin",
                  userName: actorName || "Admin",
                  userRole: actorRole || activeRole,
                  action: `Follow-up Extended from ${oldFormatted} to ${newFormatted}`,
                  previousStatus: status,
                  newStatus: status,
                  timestamp: new Date().toISOString(),
                  comments: reason,
                };

                const currentActivities = Array.isArray(proposal.activities)
                  ? [...proposal.activities]
                  : [];
                currentActivities.push(activity);
                const newCount = (proposal.followUpExtensionCount || 0) + 1;

                try {
                  await update(
                    ref(database, `proposal_documents/${proposal.id}`),
                    {
                      dueDate: newDate,
                      due_date: newDate,
                      followUpNotes: reason,
                      followUpExtensionCount: newCount,
                      activities: currentActivities,
                      updatedAt: new Date().toISOString(),
                    },
                  );
                  setDueDate(newDate);
                  toast.success(`Follow-up extended to ${newFormatted}`);
                } catch (err: any) {
                  toast.error(
                    "Failed to extend date: " + (err?.message || "Error"),
                  );
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
