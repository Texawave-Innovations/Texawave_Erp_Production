"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { useAuthStore } from "@/stores/auth-store";

export default function ChangePasswordPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) router.replace("/login");
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <ChangePasswordForm />
    </div>
  );
}
