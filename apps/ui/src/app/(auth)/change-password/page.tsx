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

  return <ChangePasswordForm />;
}
