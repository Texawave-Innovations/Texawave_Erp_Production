"use client";

import { useState } from "react";
import {
  Briefcase,
  Building,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import {
  Button,
  EmptyState,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  DetailField,
  EmployeeIdentity,
  ExecutiveSectionCard,
  HrPageHeader,
} from "@/features/hr/components";
import {
  useMyAddress,
  useMyBank,
  useMyDocuments,
  useMyEmployee,
  useMyExperience,
  useMyFamilyMembers,
  useMyGovernmentIds,
  useMyPersonal,
} from "@/features/onboarding/hooks";
import { downloadMyDocument } from "@/features/onboarding/api";

type TabKey = "overview" | "statutory" | "family_experience" | "documents";

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function safeString(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function titleCase(str: string): string {
  if (!str) return "—";
  return str
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function MyProfileView() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [revealedSensitives, setRevealedSensitives] = useState<
    Record<string, boolean>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const { toast } = useToast();

  const employee = useMyEmployee();
  const personal = useMyPersonal();
  const permanentAddress = useMyAddress("PERMANENT");
  const presentAddress = useMyAddress("PRESENT");
  const bank = useMyBank();
  const governmentIds = useMyGovernmentIds();
  const family = useMyFamilyMembers();
  const experience = useMyExperience();
  const documents = useMyDocuments();

  const toggleReveal = (key: string) => {
    setRevealedSensitives((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({
      title: "Copied to clipboard",
      description: `${text} copied.`,
      variant: "success",
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = async (docType: string, fileName: string) => {
    try {
      setDownloadingDoc(docType);
      await downloadMyDocument(docType, fileName);
      toast({
        title: "Download complete",
        description: `Successfully downloaded ${fileName}`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description:
          err instanceof Error ? err.message : "Could not download document.",
        variant: "error",
      });
    } finally {
      setDownloadingDoc(null);
    }
  };

  const empData = employee.data;
  const persData = personal.data as Record<string, unknown> | null;
  const permData = permanentAddress.data as Record<string, unknown> | null;
  const presData = presentAddress.data as Record<string, unknown> | null;
  const bankData = bank.data as Record<string, unknown> | null;
  const govData = governmentIds.data as Record<string, unknown> | null;

  const photoDoc = documents.data?.find(
    (d) => d.documentType === "PROFILE_PHOTO",
  );
  const avatarUrl =
    empData?.avatarUrl ||
    (photoDoc ? "/employee/profile/documents/PROFILE_PHOTO/file" : null);

  return (
    <div className="space-y-6 pb-12 animate-reveal">
      {/* 1. Header Banner */}
      <HrPageHeader
        title="My Profile"
        description="View and verify your official employment details, statutory IDs, residential addresses, and submitted documents."
        icon3d="profiles"
      />

      {/* 2. Employee Identity Hero Card */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        {employee.isPending ? (
          <div className="flex items-center gap-4 animate-pulse">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded-lg" />
              <Skeleton className="h-4 w-36 rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <EmployeeIdentity
                name={empData?.fullName ?? "Employee"}
                code={empData?.employeeCode ?? "—"}
                avatarUrl={avatarUrl}
                size="lg"
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                    {empData?.fullName ?? "My Profile"}
                  </h1>
                  {empData?.status ? (
                    <StatusBadge
                      label={empData.status}
                      colorToken={
                        empData.status.toUpperCase() === "ACTIVE"
                          ? "success"
                          : "gray"
                      }
                    />
                  ) : null}
                  {empData?.onboardingStatus ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                      <ShieldCheck className="h-3 w-3 text-brand-500" />
                      Onboarding: {titleCase(empData.onboardingStatus)}
                    </span>
                  ) : null}
                </div>

                <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-200/90 sm:text-sm">
                  <span className="text-[#0a3271] dark:text-sky-100 font-bold">
                    {empData?.designation?.name ?? "Designation"}
                  </span>
                  {empData?.team?.name ? ` · Team ${empData.team.name}` : ""}
                  {empData?.department?.name
                    ? ` (${empData.department.name})`
                    : ""}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                    <User className="h-3.5 w-3.5 text-brand-500" />
                    ID: #{empData?.employeeCode ?? "—"}
                  </span>
                  {empData?.workEmail ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                      <Mail className="h-3.5 w-3.5 text-brand-500" />
                      {empData.workEmail}
                    </span>
                  ) : null}
                  {empData?.phone ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                      <Phone className="h-3.5 w-3.5 text-brand-500" />
                      {empData.phone}
                    </span>
                  ) : null}
                  {empData?.dateOfJoining ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                      <Calendar className="h-3.5 w-3.5 text-brand-500" />
                      Joined {formatDate(empData.dateOfJoining)}
                    </span>
                  ) : null}
                  {empData?.workLocation?.name ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                      <MapPin className="h-3.5 w-3.5 text-brand-500" />
                      {empData.workLocation.name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-sky-200/90 bg-white/90 p-1.5 shadow-[0_2px_12px_rgba(23,105,245,0.05)] dark:border-slate-800 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "overview"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-[#2f6396] hover:bg-sky-50 hover:text-[#0a3271] dark:text-sky-300 dark:hover:bg-slate-800"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Overview & Personal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("statutory")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "statutory"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-[#2f6396] hover:bg-sky-50 hover:text-[#0a3271] dark:text-sky-300 dark:hover:bg-slate-800"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Bank & Statutory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("family_experience")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "family_experience"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-[#2f6396] hover:bg-sky-50 hover:text-[#0a3271] dark:text-sky-300 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Family & Experience</span>
          {family.data && family.data.length > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "family_experience"
                  ? "bg-white/25 text-white"
                  : "bg-sky-100 text-[#0a3271] dark:bg-slate-800 dark:text-sky-200"
              }`}
            >
              {family.data.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "documents"
              ? "bg-brand-500 text-white shadow-xs"
              : "text-[#2f6396] hover:bg-sky-50 hover:text-[#0a3271] dark:text-sky-300 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Documents</span>
          {documents.data && documents.data.length > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === "documents"
                  ? "bg-white/25 text-white"
                  : "bg-sky-100 text-[#0a3271] dark:bg-slate-800 dark:text-sky-200"
              }`}
            >
              {documents.data.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* 4. Tab Panels */}
      {/* Tab 1: Overview & Personal Details */}
      {activeTab === "overview" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Personal Information */}
          <ExecutiveSectionCard
            title="Personal Details"
            description="Core personal credentials, demographics, and parent details"
            icon3d="user"
          >
            {personal.isPending ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !persData ? (
              <p className="text-xs text-slate-400">
                Personal details not provided yet.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Date of Birth" icon={Calendar}>
                  {formatDate(persData.dateOfBirth)}
                </DetailField>
                <DetailField label="Gender" icon={User}>
                  {persData.gender ? titleCase(String(persData.gender)) : "—"}
                </DetailField>
                <DetailField label="Marital Status">
                  {persData.maritalStatus
                    ? titleCase(String(persData.maritalStatus))
                    : "—"}
                </DetailField>
                <DetailField label="Blood Group">
                  {safeString(persData.bloodGroup)}
                </DetailField>
                <DetailField label="Father's Name">
                  {safeString(persData.fatherName)}
                </DetailField>
                <DetailField label="Father's Contact">
                  {safeString(persData.fatherPhone)}
                </DetailField>
                <DetailField label="Mother's Name">
                  {safeString(persData.motherName)}
                </DetailField>
                <DetailField label="Mother's Contact">
                  {safeString(persData.motherPhone)}
                </DetailField>
                <DetailField label="Emergency Contact Person">
                  {safeString(persData.emergencyContactName)}
                </DetailField>
                <DetailField label="Emergency Relation">
                  {safeString(persData.emergencyContactRelation)}
                </DetailField>
                <DetailField label="Emergency Phone" icon={Phone}>
                  {safeString(persData.emergencyContactPhone)}
                </DetailField>
              </dl>
            )}
          </ExecutiveSectionCard>

          {/* Residential Addresses */}
          <ExecutiveSectionCard
            title="Residential Addresses"
            description="Permanent residence and current communication addresses"
            icon={MapPin}
          >
            <div className="flex flex-col gap-4">
              {/* Permanent Address */}
              <div className="rounded-2xl border-2 border-sky-200/90 bg-white p-4.5 shadow-xs dark:border-slate-700 dark:bg-slate-850">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-brand-500" />
                  Permanent Address
                </h3>
                {permanentAddress.isPending ? (
                  <Skeleton className="h-12 w-full rounded-lg" />
                ) : permData && permData.addressLine ? (
                  <address className="not-italic text-sm font-semibold leading-relaxed text-[#0a3271] dark:text-white">
                    <span className="block font-bold">
                      {String(permData.addressLine)}
                    </span>
                    {permData.areaLocality ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        {String(permData.areaLocality)},{" "}
                      </span>
                    ) : null}
                    {permData.district ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        {String(permData.district)},{" "}
                      </span>
                    ) : null}
                    <div className="mt-1 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                      {String(permData.city ?? "")},{" "}
                      {String(permData.state ?? "")} -{" "}
                      {String(permData.pincode ?? "")}
                    </div>
                  </address>
                ) : (
                  <p className="text-xs text-slate-400">
                    Permanent address not submitted.
                  </p>
                )}
              </div>

              {/* Present Address */}
              <div className="rounded-2xl border-2 border-sky-200/90 bg-white p-4.5 shadow-xs dark:border-slate-700 dark:bg-slate-850">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-brand-500" />
                  Present / Communication Address
                </h3>
                {presentAddress.isPending ? (
                  <Skeleton className="h-12 w-full rounded-lg" />
                ) : presData && presData.addressLine ? (
                  <address className="not-italic text-sm font-semibold leading-relaxed text-[#0a3271] dark:text-white">
                    <span className="block font-bold">
                      {String(presData.addressLine)}
                    </span>
                    {presData.areaLocality ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        {String(presData.areaLocality)},{" "}
                      </span>
                    ) : null}
                    {presData.district ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        {String(presData.district)},{" "}
                      </span>
                    ) : null}
                    <div className="mt-1 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                      {String(presData.city ?? "")},{" "}
                      {String(presData.state ?? "")} -{" "}
                      {String(presData.pincode ?? "")}
                    </div>
                  </address>
                ) : (
                  <p className="text-xs text-slate-400">
                    Same as permanent address or not submitted.
                  </p>
                )}
              </div>
            </div>
          </ExecutiveSectionCard>
        </div>
      ) : null}

      {/* Tab 2: Bank & Statutory */}
      {activeTab === "statutory" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Bank Details */}
          <ExecutiveSectionCard
            title="Bank Account Details"
            description="Verified disbursement bank account for payroll and reimbursement"
            icon3d="payroll"
          >
            {bank.isPending ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !bankData ? (
              <p className="text-xs text-slate-400">
                Bank details not recorded yet.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Account Holder" icon={User}>
                  {safeString(bankData.accountHolderName)}
                </DetailField>
                <DetailField label="Bank Name" icon={Building}>
                  {safeString(bankData.bankName)}
                </DetailField>
                <DetailField label="Branch Name" icon={MapPin}>
                  {safeString(bankData.branchName)}
                </DetailField>
                <DetailField label="IFSC Code">
                  <div className="flex items-center justify-between">
                    <span>{safeString(bankData.ifsc)}</span>
                    {bankData.ifsc ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(String(bankData.ifsc), "ifsc")
                        }
                        className="rounded p-1 text-slate-400 hover:text-brand-500"
                        title="Copy IFSC"
                      >
                        {copiedKey === "ifsc" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </DetailField>
                <div className="sm:col-span-2">
                  <DetailField label="Account Number" icon={CreditCard}>
                    <div className="flex items-center justify-between">
                      <span>{safeString(bankData.accountNumber)}</span>
                    </div>
                  </DetailField>
                </div>
              </dl>
            )}
          </ExecutiveSectionCard>

          {/* Government IDs */}
          <ExecutiveSectionCard
            title="Government Identifiers"
            description="Taxation, identity, and statutory compliance registrations"
            icon3d="access-control"
          >
            {governmentIds.isPending ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !govData ? (
              <p className="text-xs text-slate-400">
                Government identifiers not recorded yet.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Aadhaar Number">
                  <div className="flex items-center justify-between">
                    <span>
                      {govData.aadhaarNumber
                        ? revealedSensitives.aadhaar
                          ? String(govData.aadhaarNumber)
                          : `•••• •••• ${String(govData.aadhaarNumber).slice(-4)}`
                        : "—"}
                    </span>
                    {govData.aadhaarNumber ? (
                      <button
                        type="button"
                        onClick={() => toggleReveal("aadhaar")}
                        className="rounded p-1 text-slate-400 hover:text-brand-500"
                        title={
                          revealedSensitives.aadhaar
                            ? "Hide Aadhaar"
                            : "Show Aadhaar"
                        }
                      >
                        {revealedSensitives.aadhaar ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </DetailField>

                <DetailField label="PAN Card">
                  <div className="flex items-center justify-between">
                    <span>{safeString(govData.panNumber)}</span>
                    {govData.panNumber ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(String(govData.panNumber), "pan")
                        }
                        className="rounded p-1 text-slate-400 hover:text-brand-500"
                        title="Copy PAN"
                      >
                        {copiedKey === "pan" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </DetailField>

                <DetailField label="ESI Number">
                  {safeString(govData.esiNumber)}
                </DetailField>

                <DetailField label="PF Number">
                  {safeString(govData.pfNumber)}
                </DetailField>
              </dl>
            )}
          </ExecutiveSectionCard>
        </div>
      ) : null}

      {/* Tab 3: Family & Experience */}
      {activeTab === "family_experience" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Family Members */}
          <ExecutiveSectionCard
            title="Family Members"
            description="Immediate family dependents and emergency relations"
            icon3d="user"
            badge={
              family.data && family.data.length > 0 ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-[#0a3271] dark:bg-slate-800 dark:text-sky-200">
                  {family.data.length} registered
                </span>
              ) : null
            }
          >
            {family.isPending ? (
              <div className="space-y-3 animate-pulse">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !family.data || family.data.length === 0 ? (
              <EmptyState
                title="No family members listed"
                description="No family members were added during onboarding."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {family.data.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border-2 border-sky-200/90 bg-white p-4 shadow-xs transition-all hover:border-brand-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-850"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0a3271] dark:bg-slate-800 dark:text-sky-200 font-bold text-sm">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0a3271] dark:text-white">
                          {m.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-brand-600 dark:text-sky-400">
                            {m.relation}
                          </span>
                          {m.dateOfBirth ? (
                            <>
                              <span>·</span>
                              <span>DOB: {formatDate(m.dateOfBirth)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {m.contactPhone ? (
                      <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                        <Phone className="h-3 w-3 text-brand-500" />
                        {m.contactPhone}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </ExecutiveSectionCard>

          {/* Work Experience */}
          <ExecutiveSectionCard
            title="Work Experience"
            description="Prior employment records and professional tenure"
            icon3d="calendar"
            badge={
              experience.data && experience.data.length > 0 ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-[#0a3271] dark:bg-slate-800 dark:text-sky-200">
                  {experience.data.length} records
                </span>
              ) : null
            }
          >
            {experience.isPending ? (
              <div className="space-y-3 animate-pulse">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !experience.data || experience.data.length === 0 ? (
              <EmptyState
                title="No prior experience listed"
                description="No previous work experience was registered during onboarding."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {experience.data.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex flex-col gap-2 rounded-2xl border-2 border-sky-200/90 bg-white p-4.5 shadow-xs transition-all hover:border-brand-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-850"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0a3271] dark:bg-slate-800 dark:text-sky-200">
                          <Briefcase className="h-5 w-5 text-brand-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#0a3271] dark:text-white">
                            {exp.designation}
                          </h4>
                          <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                            {exp.employer}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                        <Calendar className="h-3 w-3 text-brand-500" />
                        {formatDate(exp.fromDate)} —{" "}
                        {exp.toDate ? formatDate(exp.toDate) : "Present"}
                      </span>
                    </div>

                    {exp.reasonForLeaving ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 pl-13">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Reason:{" "}
                        </span>
                        {exp.reasonForLeaving}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </ExecutiveSectionCard>
        </div>
      ) : null}

      {/* Tab 4: Documents */}
      {activeTab === "documents" ? (
        <ExecutiveSectionCard
          title="Submitted Documents"
          description="Official identity cards, certificates, and compliance documentation"
          icon3d="reports"
          badge={
            documents.data && documents.data.length > 0 ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-[#0a3271] dark:bg-slate-800 dark:text-sky-200">
                {documents.data.length} files
              </span>
            ) : null
          }
        >
          {documents.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : !documents.data || documents.data.length === 0 ? (
            <EmptyState
              title="No documents uploaded"
              description="No documents have been uploaded to your profile yet."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.data.map((doc) => {
                const isDownloading = downloadingDoc === doc.documentType;
                return (
                  <div
                    key={doc.documentType}
                    className="flex flex-col justify-between gap-3.5 rounded-2xl border-2 border-sky-200/90 bg-white p-4.5 shadow-xs transition-all hover:border-brand-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-850"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0a3271] dark:bg-slate-800 dark:text-sky-200 mb-1">
                          {titleCase(doc.documentType)}
                        </span>
                        <h4
                          className="truncate text-xs font-bold text-[#0a3271] dark:text-white"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </h4>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Uploaded {formatDate(doc.uploadedAt)}
                          {doc.sizeBytes
                            ? ` · ${(doc.sizeBytes / 1024).toFixed(0)} KB`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        handleDownload(doc.documentType, doc.fileName)
                      }
                      disabled={isDownloading}
                      className="w-full justify-center rounded-xl border border-sky-200/90 bg-sky-50/80 text-xs font-bold text-[#0a3271] shadow-2xs hover:bg-sky-100/80 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
                      {isDownloading ? "Downloading..." : "Download file"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ExecutiveSectionCard>
      ) : null}
    </div>
  );
}
