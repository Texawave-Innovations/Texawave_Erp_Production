"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@texawave-erp/ui-kit";
import { useCreateProject } from "@/features/projects/hooks";
import { ProjectForm } from "@/features/projects/components/ProjectForm";
import { errorMessage } from "@/features/projects/format";

export default function NewProjectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const createMutation = useCreateProject();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: Record<string, unknown>) {
    setError(null);
    try {
      const created = await createMutation.mutateAsync(payload);
      toast({
        title: `Project ${created.projectCode} created successfully`,
        variant: "success",
      });
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create project"));
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
