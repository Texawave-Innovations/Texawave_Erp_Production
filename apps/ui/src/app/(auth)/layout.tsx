import type { ReactNode } from "react";
import { TexaEcosystemBackground } from "@/features/auth/components/login_page/TexaEcosystemBackground";
import "@/features/auth/components/login_page/texa-ecosystem.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full relative overflow-x-hidden bg-slate-50 font-sans">
      {/* Unified 2.5D Animated Enterprise Ecosystem Background */}
      <TexaEcosystemBackground />

      {/* Foreground Page Layout: Left Spacer for Ecosystem, Right Column for Cards */}
      <div className="relative z-20 min-h-screen w-full flex flex-col lg:flex-row items-center justify-between pointer-events-none">
        {/* Left Spacer: Focus on ERP ecosystem illustration */}
        <div className="hidden lg:flex flex-1 min-w-0" aria-hidden="true" />

        {/* Right Column: Dedicated container that never squishes the card */}
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 lg:p-10 lg:pr-16 xl:pr-24 pointer-events-none shrink-0 w-full lg:w-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
