"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Semantic3DIcon,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useUploadEmployeeDocument } from "@/features/hr/employee-documents/hooks";
import { useCreateEmployee, useEmployee, useUpdateEmployee } from "../hooks";
import {
  buildCreatePayload,
  buildUpdatePayload,
  formFromDetail,
  type EmployeeFormValues,
} from "../schema";
import { WRITE_TEAM_OR_ALL } from "../permissions";
import { EmployeeForm } from "./EmployeeForm";

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to change employees">
      Ask an administrator for the <code>hr.employee.write</code> permission.
    </Alert>
  );
}

export function EmployeeCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const createMutation = useCreateEmployee();

  if (!canWrite) return <NoWriteAccess />;

  async function handleSubmit(values: EmployeeFormValues) {
    const created = await createMutation.mutateAsync(
      buildCreatePayload(values),
    );
    toast({
      title: `${created.fullName} added as ${created.employeeCode}`,
      variant: "success",
    });
    router.push(`/hr/employees/${created.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-reveal">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/hr/employees"
              className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to employees</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title-sm font-bold tracking-tight text-[#0a3271] dark:text-white">
                New Employee
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/80 px-3 py-0.5 text-[11px] font-bold text-brand-500 shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                Employee Master Form
              </span>
            </div>

            <p className="max-w-2xl text-[12px] font-medium text-[#2f6396] dark:text-sky-300/80">
              The employee code is generated automatically upon creation. New employees initialize with Active status.
            </p>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-2 shadow-[0_8px_20px_rgba(23,105,245,0.12)] ring-4 ring-white/70 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-800/60">
              <Semantic3DIcon name="user" size={42} alt="New employee" />
            </div>
          </div>
        </div>

        {/* 3-Step Wizard Roadmap */}
        <div className="mt-5 pt-4 border-t border-sky-200/90 dark:border-slate-700 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-[#2f6396] dark:text-sky-300/70">
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">1</span>
            Personal & Contact
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">2</span>
            Employment & Organization
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">3</span>
            Probation & Referral
          </span>
        </div>
      </div>

      <EmployeeForm
        submitLabel="Create employee"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/hr/employees")}
      />
    </div>
  );
}

export function EmployeeEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const query = useEmployee(id);
  const updateMutation = useUpdateEmployee();
  const queryClient = useQueryClient();
  const uploadMutation = useUploadEmployeeDocument(id);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!canWrite) return <NoWriteAccess />;

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-pulse">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <div className="mx-auto max-w-4xl rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
          <EmptyState
            title="Employee not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="font-bold text-brand-500 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </div>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const employee = query.data;
  const initial = formFromDetail(employee);
  const currentAvatarUrl = uploadedAvatarUrl ?? employee.avatarUrl ?? null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file format",
        description: "Please select an image file (PNG, JPG, JPEG, or WebP).",
        variant: "warning",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Photo file size must not exceed 5MB.",
        variant: "warning",
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const res = await uploadMutation.mutateAsync({
        label: "Profile Photo",
        file,
        documentType: "PROFILE_PHOTO",
      });
      const newAvatarUrl = `/hr/employees/${id}/documents/${res.id}/file`;
      setUploadedAvatarUrl(newAvatarUrl);
      await queryClient.invalidateQueries({ queryKey: ["hr-employees", id] });
      toast({
        title: "Profile photo updated",
        description: "Employee photo has been uploaded and updated successfully.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload the profile photo. Please try again.",
        variant: "error",
      });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  async function handleSubmit(values: EmployeeFormValues) {
    const body = buildUpdatePayload(initial, values, employee.version);
    if (Object.keys(body).length === 1) {
      // Only `version` is left, so nothing changed. Skip the request.
      router.push(`/hr/employees/${id}`);
      return;
    }
    await updateMutation.mutateAsync({ id, body });
    toast({ title: "Employee updated", variant: "success" });
    router.push(`/hr/employees/${id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-reveal">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href={`/hr/employees/${id}`}
              className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to {employee.fullName}</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title-sm font-bold tracking-tight text-[#0a3271] dark:text-white">
                Edit Employee
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/80 px-3 py-0.5 text-[11px] font-bold text-brand-500 shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                {employee.employeeCode}
              </span>
            </div>

            <p className="max-w-2xl text-[12px] font-medium text-[#2f6396] dark:text-sky-300/80">
              Update identity, organizational assignment, and probation details. Status changes are managed separately from the employee record.
            </p>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-2 shadow-[0_8px_20px_rgba(23,105,245,0.12)] ring-4 ring-white/70 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-800/60">
              <Semantic3DIcon name="edit" size={42} alt="Edit employee" />
            </div>
          </div>
        </div>

        {/* 3-Step Wizard Roadmap */}
        <div className="mt-5 pt-4 border-t border-sky-200/90 dark:border-slate-700 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-[#2f6396] dark:text-sky-300/70">
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">1</span>
            Personal & Contact
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">2</span>
            Employment & Organization
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">3</span>
            Probation & Referral
          </span>
        </div>
      </div>

      {/* Profile Photo Section */}
      <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
            <Camera className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
              Employee Photo
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
              Official employee photo. Reflected across HR profiles, employee documents, and system records.
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
            <div className="flex items-center gap-4">
              <EmployeeIdentity
                name={employee.fullName}
                code={employee.employeeCode}
                avatarUrl={currentAvatarUrl}
                size="lg"
              />
              <div>
                <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
                  {employee.fullName}
                </h3>
                <p className="text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                  {currentAvatarUrl ? "Custom profile photo is active" : "Default initials avatar"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  PNG, JPG, or WebP up to 5MB.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="rounded-xl border border-sky-200/90 bg-white px-4 py-2 text-xs font-bold text-[#0a3271] shadow-2xs hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-brand-500" />
                ) : (
                  <Camera className="h-4 w-4 mr-1.5 text-brand-500" />
                )}
                {isUploadingPhoto ? "Uploading..." : currentAvatarUrl ? "Change Photo" : "Upload Photo"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EmployeeForm
        initialValues={initial}
        initialManager={
          employee.reportsTo
            ? {
                id: employee.reportsTo.id,
                label: `${employee.reportsTo.fullName} (${employee.reportsTo.employeeCode})`,
              }
            : null
        }
        initialTeamName={employee.team.name}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/hr/employees/${id}`)}
      />
    </div>
  );
}
