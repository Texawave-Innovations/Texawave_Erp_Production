"use client";

import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <ForgotPasswordForm />
    </div>
  );
}
