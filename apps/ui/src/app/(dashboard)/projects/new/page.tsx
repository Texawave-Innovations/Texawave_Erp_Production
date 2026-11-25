"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveErrorText } from "@texawave-erp/core";
import { useNotify } from "@/hooks/useNotify";
import { useCreateProject } from "@/features/projects/hooks";
import { ProjectForm } from "@/features/projects/components/ProjectForm";

export default function NewProjectPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const createMutation = useCreateProject();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: Record<string, unknown>) {
    setError(null);
    try {
      const created = await createMutation.mutateAsync(payload);
      notify("projects.project.created", { code: created.projectCode });
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(resolveErrorText(err, "projects.project.createFailed"));
    }
  }

  return (
    <ProjectForm
      submitting={createMutation.isPending}
      error={error}
      cancelHref="/projects/list"
      onSubmit={handleSubmit}
    />
  );
}
