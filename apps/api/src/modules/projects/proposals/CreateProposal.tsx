import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, push, set } from "firebase/database";
import { database } from "@/services/firebase";
import {
  ProposalTemplate,
  ProposalDocument,
  OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE,
} from "../proposalTypes";
import { Project } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  Hash,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export default function CreateProposal() {
  const navigate = useNavigate();

  // Master Data State
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [proposalNumber, setProposalNumber] = useState("");
  const [title, setTitle] = useState("Client Proposal & Statement of Work");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [preparedBy, setPreparedBy] = useState("TexaWave Project Team");
  const [proposalDate, setProposalDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Follow-up Due Date (default +7 days)
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  useEffect(() => {
    // 1. Fetch available templates
    const unsubTemplates = onValue(
      ref(database, "proposal_templates"),
      (snap) => {
        let activeTemplates: ProposalTemplate[] = [];
        if (!snap.exists()) {
          activeTemplates = [OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE];
        } else {
          const data = snap.val();
          const list: ProposalTemplate[] = Object.entries(data).map(
            ([id, val]: [string, any]) => ({
              id,
              ...val,
              sections: Array.isArray(val.sections)
                ? val.sections
                : typeof val.sections === "object" && val.sections !== null
                  ? Object.values(val.sections)
                  : [],
            }),
          );

          activeTemplates = list.filter((t) => t.status === "active");
          if (activeTemplates.length === 0) {
            activeTemplates = [OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE];
          }
        }

        activeTemplates.sort(
          (a, b) => (b.version_number || 0) - (a.version_number || 0),
        );
        setTemplates(activeTemplates);

        // Default select TexaWave template if not selected
        if (!selectedTemplateId && activeTemplates.length > 0) {
          setSelectedTemplateId(activeTemplates[0].id);
        }
        setLoading(false);
      },
    );

    // 2. Fetch projects
    const unsubProjects = onValue(ref(database, "projects"), (snap) => {
      if (!snap.exists()) {
        setProjects([]);
        return;
      }
      const data = snap.val();
      const list: Project[] = Object.entries(data).map(
        ([id, val]: [string, any]) => ({
          id,
          ...val,
        }),
      );
      setProjects(list);
    });

    // 3. Fetch proposal_settings and calculate next Proposal Number dynamically
    const unsubSettings = onValue(
      ref(database, "proposal_settings"),
      (snapSettings) => {
        const cfg = snapSettings.exists() ? snapSettings.val() : {};
        const prefix = cfg.prefix || "TXW-PROP";
        const yearFormat = cfg.yearFormat || "YYYY";
        const sequenceDigits = cfg.sequenceDigits || 3;

        const currentYear = new Date().getFullYear();
        let yearPart = "";
        if (yearFormat === "YYYY") {
          yearPart = `-${currentYear}`;
        } else if (yearFormat === "YY") {
          yearPart = `-${String(currentYear).slice(-2)}`;
        }

        onValue(
          ref(database, "proposal_documents"),
          (snapDocs) => {
            let count = cfg.nextSequence || 1;
            if (snapDocs.exists()) {
              const countExisting = Object.keys(snapDocs.val()).length;
              count = countExisting + 1;
            }
            const pad = String(count).padStart(sequenceDigits, "0");
            setProposalNumber(`${prefix}${yearPart}-${pad}`);
          },
          { onlyOnce: true },
        );
      },
    );

    return () => {
      unsubTemplates();
      unsubProjects();
      unsubSettings();
    };
  }, []);

  // When project is selected, autofill client name
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      const projClient = proj.customerName || proj.client;
      if (projClient) setClientName(projClient);
    }
  };

  // Selected template object
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proposalNumber.trim()) {
      toast.error("Proposal Number is required");
      return;
    }
    if (!title.trim()) {
      toast.error("Proposal Title is required");
      return;
    }
    if (!selectedTemplateId || !selectedTemplate) {
      toast.error("Please select a Proposal Template");
      return;
    }

    setSubmitting(true);
    try {
      const proj = projects.find((p) => p.id === selectedProjectId);
      const now = new Date().toISOString();

      // Create deeply cloned immutable snapshot of the template
      const templateSnapshot: ProposalTemplate = JSON.parse(
        JSON.stringify(selectedTemplate),
      );

      // Build Proposal Document
      const newProposalRef = push(ref(database, "proposal_documents"));
      const proposalId = newProposalRef.key!;

      const projCode = proj?.projectCode || (proj as any)?.code || "";
      const projClientId = proj?.customerId || (proj as any)?.clientId || "";
      const projClientName =
        proj?.customerName ||
        proj?.client ||
        (proj as any)?.clientName ||
        "General Client";

      const newProposal: ProposalDocument = {
        id: proposalId,
        proposal_number: proposalNumber.trim(),
        proposalNumber: proposalNumber.trim(),
        title: title.trim(),
        project_id: proj?.id || "",
        projectId: proj?.id || "",
        project_code: projCode,
        projectCode: projCode,
        project_name: proj?.name || "",
        projectName: proj?.name || "",
        client_id: projClientId,
        clientId: projClientId,
        client_name: clientName.trim() || projClientName,
        clientName: clientName.trim() || projClientName,
        template_id: selectedTemplate.id,
        templateId: selectedTemplate.id,
        template_title: selectedTemplate.name,
        templateTitle: selectedTemplate.name,
        template_code: selectedTemplate.code,
        templateCode: selectedTemplate.code,
        template_version: selectedTemplate.version,
        templateVersion: selectedTemplate.version,
        template_version_id: selectedTemplate.id,
        templateSnapshot, // Immutable snapshot protecting previously issued document
        proposal_data: {},
        sectionValues: {},
        status: "draft",
        preparedBy: preparedBy.trim(),
        proposalDate,
        dueDate: dueDate || "",
        due_date: dueDate || "",
        activities: [
          {
            id: `act_${Date.now()}`,
            user: preparedBy.trim() || "Arun",
            userName: preparedBy.trim() || "Arun",
            userRole: "Author",
            action: `Proposal created by ${preparedBy.trim() || "Author"}`,
            newStatus: "draft",
            timestamp: now,
            comments:
              "Initial draft initialized from master template snapshot.",
          },
        ],
        created_by: preparedBy.trim() || "Admin",
        createdBy: preparedBy.trim() || "Admin",
        created_at: now,
        createdAt: now,
        updated_at: now,
        updatedAt: now,
      };

      await set(newProposalRef, newProposal);
      toast.success(
        `Proposal ${proposalNumber} initialized from template snapshot!`,
      );

      // Seamlessly navigate to Proposal Editor
      navigate(`/projects/proposals/${proposalId}/edit`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to initialize proposal");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading
        proposal creator...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/projects/proposals")}
              className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs font-black px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-xl text-emerald-100 border border-white/20">
              STEP 1
            </span>
            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold">
              Proposal Information
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Create Client Proposal
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm pl-1">
            Specify proposal information and link a reusable template snapshot.
          </p>
        </div>
      </div>

      {/* 2. Step 1 Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
          <CardHeader className="p-6 bg-slate-50/60 border-b border-slate-100">
            <CardTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Proposal
              Information
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              Enter client details, proposal number, and select the base master
              template.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Proposal Number, Date & Follow-up Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-emerald-600" /> Proposal
                    Number <span className="text-rose-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Auto-generated
                  </span>
                </div>
                <Input
                  value={proposalNumber}
                  onChange={(e) => setProposalNumber(e.target.value)}
                  placeholder="e.g. TXW-PROP-2026-001"
                  className="h-10 rounded-xl text-xs font-mono font-bold bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" /> Proposal
                  Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={proposalDate}
                  onChange={(e) => setProposalDate(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" /> Follow-up
                    Due
                  </Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setDueDate(d.toISOString().split("T")[0]);
                      }}
                      className="text-[9.5px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 14);
                        setDueDate(d.toISOString().split("T")[0]);
                      }}
                      className="text-[9.5px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded"
                    >
                      +14d
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Proposal Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Proposal Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mechanical Engineering & Automation Design Proposal"
                className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
              />
            </div>

            {/* Project & Client Identification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />{" "}
                  Associated Project
                </Label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">-- Select Project (Optional) --</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} (
                      {proj.projectCode || (proj as any).code || "PROJ"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Client
                  / Customer Name
                </Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Industrial Dynamics Ltd"
                  className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Prepared By */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-emerald-600" /> Prepared By
              </Label>
              <Input
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="e.g. John Doe (Lead Engineering Consultant)"
                className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white"
              />
            </div>

            {/* Master Template Selection */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-600" /> Select
                    Document Template <span className="text-rose-500">*</span>
                  </Label>
                  <p className="text-[11px] text-slate-400">
                    A snapshot of this template will be attached to this
                    proposal to guarantee version stability.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-semibold bg-white text-slate-700"
                >
                  {templates.length} Available Templates
                </Badge>
              </div>

              {templates.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    No active proposal templates found
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Please create and configure a template first in Template
                    Management.
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate("/projects/proposals/templates")}
                    variant="outline"
                    className="rounded-xl text-xs h-8"
                  >
                    Go to Proposal Templates
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    const secCount = tpl.sections?.length || 0;

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/30"
                            : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                                {tpl.code}
                              </span>
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                Version {tpl.version}
                              </Badge>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {tpl.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {tpl.department ||
                                tpl.category ||
                                "General Template"}
                            </p>
                          </div>

                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : "border border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                          <span>{secCount} Configured Sections</span>
                          <span>•</span>
                          <span className="capitalize">{tpl.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Template Snapshot Protection Notice */}
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
              <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Template Snapshot Version Guarantee</p>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  Upon clicking <strong>Continue</strong>, an exact copy of the
                  selected template structure, sections, table columns, and
                  rules will be locked into this proposal. Subsequent edits or
                  version upgrades to the master template will never alter this
                  issued proposal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/projects/proposals")}
            className="rounded-2xl text-xs h-10 px-5 font-semibold bg-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Cancel
          </Button>

          <Button
            type="submit"
            disabled={submitting || !selectedTemplateId}
            style={{
              background:
                "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
            }}
            className="text-white font-bold rounded-2xl text-xs h-10 px-6 shadow-md hover:opacity-95"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-1.5" />
            )}
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
