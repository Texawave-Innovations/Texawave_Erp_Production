// src/modules/projects/mom/components/MomRevisionHistoryModal.tsx

import React, { useState } from "react";
import { MomDocument, MomRevision, MomHistoryEvent } from "../types/mom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Clock,
  User,
  Eye,
  FileCheck2,
  GitBranch,
  Archive,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { MomPreviewModal } from "./MomPreviewModal";

interface MomRevisionHistoryModalProps {
  document: MomDocument | null;
  open: boolean;
  onClose: () => void;
}

const ACTION_ICONS: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  created: {
    icon: PlusCircleIcon,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    label: "Created",
  },
  saved_draft: {
    icon: Clock,
    color: "text-slate-600 bg-slate-50 border-slate-200",
    label: "Draft Saved",
  },
  finalized: {
    icon: CheckCircle2,
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    label: "Finalized",
  },
  revision_started: {
    icon: GitBranch,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    label: "Revision Started",
  },
  revised_version_finalized: {
    icon: FileCheck2,
    color: "text-emerald-800 bg-emerald-100 border-emerald-300",
    label: "Revision Finalized",
  },
  archived: {
    icon: Archive,
    color: "text-gray-600 bg-gray-100 border-gray-300",
    label: "Archived",
  },
  restored: {
    icon: RotateCcw,
    color: "text-teal-700 bg-teal-50 border-teal-200",
    label: "Restored",
  },
};

function PlusCircleIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v8m-4-4h8"
      />
    </svg>
  );
}

export const MomRevisionHistoryModal: React.FC<
  MomRevisionHistoryModalProps
> = ({ document: doc, open, onClose }) => {
  const [activeTab, setActiveTab] = useState<"revisions" | "timeline">(
    "revisions",
  );
  const [previewRevDoc, setPreviewRevDoc] = useState<MomDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!doc) return null;

  const revisions = Array.isArray(doc.revisions)
    ? [...doc.revisions].reverse()
    : [];
  const historyEvents = Array.isArray(doc.history)
    ? [...doc.history].reverse()
    : [];

  const handleOpenRevisionPreview = (rev: MomRevision) => {
    // Construct reconstructed document snapshot for previewing
    const reconstructed: MomDocument = {
      ...doc,
      meetingTitle: rev.snapshot.meetingTitle || doc.meetingTitle,
      meetingDate: rev.snapshot.meetingDate || doc.meetingDate,
      startTime: rev.snapshot.startTime || doc.startTime,
      endTime: rev.snapshot.endTime || doc.endTime,
      timezone: rev.snapshot.timezone || doc.timezone,
      location: rev.snapshot.location || doc.location,
      attendees: rev.snapshot.attendees || [],
      absentees: rev.snapshot.absentees || [],
      agenda: rev.snapshot.agenda || [],
      meetingNotes: rev.snapshot.meetingNotes || [],
      status: rev.snapshot.status || "finalized",
      currentRevision: rev.revisionNumber,
    };
    setPreviewRevDoc(reconstructed);
    setPreviewOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6 rounded-3xl">
          <DialogHeader className="border-b border-border pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Document History & Revisions
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {doc.reference}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase ${
                    doc.status === "finalized"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : doc.status === "archived"
                        ? "bg-gray-100 text-gray-600 border-gray-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {doc.status}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {doc.meetingTitle} • Project: [{doc.projectCode}]{" "}
              {doc.projectName}
            </DialogDescription>

            {/* Sub Tabs */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant={activeTab === "revisions" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("revisions")}
                style={
                  activeTab === "revisions"
                    ? {
                        background:
                          "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                      }
                    : undefined
                }
                className={`rounded-xl text-xs font-bold h-7 ${
                  activeTab === "revisions"
                    ? "text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                Preserved Revisions ({revisions.length})
              </Button>
              <Button
                variant={activeTab === "timeline" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("timeline")}
                style={
                  activeTab === "timeline"
                    ? {
                        background:
                          "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                      }
                    : undefined
                }
                className={`rounded-xl text-xs font-bold h-7 ${
                  activeTab === "timeline"
                    ? "text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Audit Trail ({historyEvents.length})
              </Button>
            </div>
          </DialogHeader>

          {/* TAB 1: Preserved Revisions */}
          {activeTab === "revisions" && (
            <div className="space-y-3 pt-2">
              {revisions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No preserved revision snapshots available yet.
                </div>
              ) : (
                revisions.map((rev) => {
                  const isCurrent = rev.revisionNumber === doc.currentRevision;
                  return (
                    <div
                      key={rev.revisionNumber}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrent
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-background border border-border text-foreground">
                              Revision {rev.revisionNumber}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                Current Official Version
                              </Badge>
                            )}
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(rev.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-foreground pt-0.5">
                            {rev.changeSummary || "Revision snapshot captured"}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Actor:{" "}
                            <span className="font-medium text-foreground">
                              {rev.userName}
                            </span>
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRevisionPreview(rev)}
                          className="self-start sm:self-center rounded-xl text-xs font-bold h-8 border-border bg-background hover:bg-muted"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1 text-primary" />
                          View Snapshot
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Activity Audit Trail */}
          {activeTab === "timeline" && (
            <div className="space-y-4 pt-2">
              {historyEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No activity history events recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {historyEvents.map((evt) => {
                    const cfg = ACTION_ICONS[evt.action] || {
                      icon: Clock,
                      color: "text-slate-600 bg-slate-50 border-slate-200",
                      label: evt.action,
                    };
                    const IconComp = cfg.icon;

                    return (
                      <div key={evt.id} className="relative group">
                        <div
                          className={`absolute -left-6 top-1 h-5 w-5 rounded-full border flex items-center justify-center ${cfg.color}`}
                        >
                          <IconComp className="h-2.5 w-2.5" />
                        </div>
                        <div className="bg-card p-3 rounded-xl border border-border space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground capitalize">
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(evt.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {evt.details && (
                            <p className="text-xs text-muted-foreground">
                              {evt.details}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                            <User className="h-2.5 w-2.5" />
                            By:{" "}
                            <span className="font-semibold text-foreground">
                              {evt.userName}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Snapshot Preview Modal */}
      <MomPreviewModal
        document={previewRevDoc}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};
