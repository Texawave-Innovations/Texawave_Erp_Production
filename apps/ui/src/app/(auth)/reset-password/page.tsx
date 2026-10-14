"use client";

import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    /* useSearchParams requires a Suspense boundary in the app router */
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
