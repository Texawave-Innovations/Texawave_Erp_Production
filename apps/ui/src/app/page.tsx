import Link from "next/link";

// Server Component (no "use client") — pure static markup, no data fetching
// or interactivity, so there's no reason for it to be a Client Component
// (Docs/CODING_STANDARDS.md "Frontend API/state/error standard" — Server
// vs. Client Component boundaries).
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-900">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        TexaWave ERP
      </h1>
      <p className="max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
        Foundation build — see Docs/ARCHITECTURE.md for what&apos;s implemented.
        The reference feature demonstrates the full stack end to end.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-[#55c9f5] via-[#318cf5] to-[#2459e8] px-5 py-2.5 text-theme-sm font-medium text-white shadow-[0_2px_8px_rgba(36,89,232,0.22),0_1px_2px_rgba(15,23,42,0.06)] hover:from-[#42bef0] hover:via-[#257fe8] hover:to-[#1b4cdb] hover:shadow-[0_4px_14px_rgba(36,89,232,0.32)] active:from-[#2b9ce8] active:via-[#1e6edb] active:to-[#1642c5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#318cf5] focus-visible:ring-offset-2 transition-all duration-200"
      >
        Sign in
      </Link>
    </div>
  );
}
