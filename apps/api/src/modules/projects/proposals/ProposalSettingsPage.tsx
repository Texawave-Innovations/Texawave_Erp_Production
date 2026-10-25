import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, set } from "firebase/database";
import { database } from "@/services/firebase";
import { ProposalSettings, DEFAULT_PROPOSAL_SETTINGS } from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  ArrowLeft,
  Save,
  Building2,
  LayoutTemplate,
  Hash,
  Image as ImageIcon,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  ShieldCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export default function ProposalSettingsPage() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<ProposalSettings>(
    DEFAULT_PROPOSAL_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(database, "proposal_settings"), (snap) => {
      if (snap.exists()) {
        setSettings({
          ...DEFAULT_PROPOSAL_SETTINGS,
          ...snap.val(),
        });
      } else {
        setSettings(DEFAULT_PROPOSAL_SETTINGS);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleFieldChange = (key: keyof ProposalSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await set(ref(database, "proposal_settings"), {
        ...settings,
        logoUrl: settings.logoUrl || "/Texa_Logo.jpeg",
        updatedAt: new Date().toISOString(),
      });
      toast.success("Proposal document settings saved successfully!");
      navigate("/projects/proposals");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save proposal settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_PROPOSAL_SETTINGS);
    toast.info("Settings reset to default values. Click Save to persist.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading
        proposal settings...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* 1. Header Banner */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6"
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
              CONFIGURATION
            </span>
            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold">
              Document Branding & Header Layout
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Proposal Document Settings
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm pl-1">
            Configure company branding, official logo, header title, and footer
            settings for all proposal documents.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="outline"
            onClick={handleResetDefaults}
            className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-bold rounded-2xl shadow-sm px-4 py-2.5 h-auto text-xs"
          >
            <RotateCcw className="h-4 w-4 mr-1.5 text-white" /> Reset
          </Button>

          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl shadow-md px-5 py-2.5 h-auto transition-all duration-200 hover:scale-[1.02] text-xs"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5 text-emerald-700" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Settings Forms (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: Company Details */}
          <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
            <CardHeader className="p-6 bg-slate-50/60 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" /> Company
                Details
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                Information dynamically displayed in the header banner, footer,
                and signature blocks.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Company Name
                </Label>
                <Input
                  value={settings.companyName}
                  onChange={(e) =>
                    handleFieldChange("companyName", e.target.value)
                  }
                  placeholder="e.g. TexaWave Innovations Pvt Ltd"
                  className="rounded-xl text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Company Logo URL (Optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={settings.logoUrl || ""}
                    onChange={(e) =>
                      handleFieldChange("logoUrl", e.target.value)
                    }
                    placeholder="https://example.com/logo.png"
                    className="rounded-xl text-xs h-9 flex-1"
                  />
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="h-9 w-9 object-contain rounded-lg border border-slate-200 p-0.5 bg-slate-50"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-emerald-600" /> Official
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="info@texawave.com"
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" /> Phone
                    Number
                  </Label>
                  <Input
                    value={settings.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" /> Official
                  Website
                </Label>
                <Input
                  value={settings.website}
                  onChange={(e) => handleFieldChange("website", e.target.value)}
                  placeholder="www.texawave.com"
                  className="rounded-xl text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Registered
                  Address
                </Label>
                <Textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  placeholder="Plot 42, Tech Innovation Corridor, Bengaluru, Karnataka, India"
                  className="rounded-xl text-xs leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: Header & Footer Settings */}
          <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
            <CardHeader className="p-6 bg-slate-50/60 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-emerald-600" /> Header &
                Footer Visibility
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                Choose which branding elements appear on generated proposal
                documents and PDF pages.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Header Settings */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Header Settings
                </h4>
                <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Company Logo (Right Aligned)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display official logo on the top right header
                      </p>
                    </div>
                    <Switch
                      checked={settings.showHeaderLogo}
                      onCheckedChange={(c) =>
                        handleFieldChange("showHeaderLogo", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Company Name
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display centered company name above proposal title
                      </p>
                    </div>
                    <Switch
                      checked={settings.showHeaderCompanyName}
                      onCheckedChange={(c) =>
                        handleFieldChange("showHeaderCompanyName", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Document Title
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display bold centered title (Client Proposal & Statement
                        of Work)
                      </p>
                    </div>
                    <Switch
                      checked={settings.showHeaderDocTitle}
                      onCheckedChange={(c) =>
                        handleFieldChange("showHeaderDocTitle", c)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Footer Settings */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Footer Settings
                </h4>
                <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Email in Footer
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display official contact email
                      </p>
                    </div>
                    <Switch
                      checked={settings.showFooterEmail}
                      onCheckedChange={(c) =>
                        handleFieldChange("showFooterEmail", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Phone Number
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display company telephone contact
                      </p>
                    </div>
                    <Switch
                      checked={settings.showFooterPhone}
                      onCheckedChange={(c) =>
                        handleFieldChange("showFooterPhone", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Official Website
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Display website URL in footer
                      </p>
                    </div>
                    <Switch
                      checked={settings.showFooterWebsite}
                      onCheckedChange={(c) =>
                        handleFieldChange("showFooterWebsite", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Registered Address
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Include office address in bottom notice
                      </p>
                    </div>
                    <Switch
                      checked={settings.showFooterAddress}
                      onCheckedChange={(c) =>
                        handleFieldChange("showFooterAddress", c)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Show Page Numbers
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Render dynamic pagination (e.g. Page 1 of 1)
                      </p>
                    </div>
                    <Switch
                      checked={settings.showFooterPageNumber}
                      onCheckedChange={(c) =>
                        handleFieldChange("showFooterPageNumber", c)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Live Document Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-4">
          <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200/80 min-h-[700px] flex flex-col shadow-inner">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-800">
                  Branding & Layout Preview
                </span>
              </div>
              <Badge
                variant="outline"
                className="bg-white text-[10px] font-mono"
              >
                Live Simulation
              </Badge>
            </div>

            {/* Simulated Sheet matching Clean Header Specification */}
            <div className="bg-white shadow-xl rounded-2xl border border-slate-300 p-8 flex-1 flex flex-col space-y-6 relative overflow-hidden text-slate-800 text-xs">
              {/* Header Preview matching User Layout */}
              <div className="relative pb-5 border-b border-slate-300">
                {/* Center: Company Name & Proposal Title */}
                <div className="text-center px-20 space-y-1">
                  {settings.showHeaderCompanyName && (
                    <p className="text-base font-serif text-slate-900 tracking-normal font-normal">
                      {settings.companyName || "TexaWave Innovations Pvt Ltd"}
                    </p>
                  )}
                  {settings.showHeaderDocTitle && (
                    <h2 className="text-lg font-serif font-black text-slate-950 tracking-tight">
                      Client Proposal & Statement of Work
                    </h2>
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

              {/* Body Content Simulation */}
              <div className="space-y-4 flex-1 text-[11px] text-slate-600">
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                  <h4 className="font-bold text-slate-800 text-xs">
                    1.0 Executive Summary
                  </h4>
                  <p className="text-slate-500 text-[10px] leading-relaxed">
                    Customized proposal document formatted automatically with
                    clean corporate header specifications.
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                  <h4 className="font-bold text-slate-800 text-xs">
                    2.0 Scope of Work
                  </h4>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-500">
                    <li>System engineering design & prototyping</li>
                    <li>Quality verification and client signoff</li>
                  </ul>
                </div>
              </div>

              {/* Footer Preview */}
              <div className="pt-4 mt-auto border-t border-slate-200 text-[9px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {settings.showFooterEmail && <span>{settings.email}</span>}
                    {settings.showFooterPhone && (
                      <span>• {settings.phone}</span>
                    )}
                    {settings.showFooterWebsite && (
                      <span>• {settings.website}</span>
                    )}
                  </div>
                  {settings.showFooterPageNumber && <span>Page 1 of 1</span>}
                </div>
                {settings.showFooterAddress && (
                  <p className="text-[8.5px] text-slate-400/80">
                    {settings.address}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
