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
        className="rounded-lg bg-brand-500 px-4 py-2.5 text-theme-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-400 dark:text-gray-900"
      >
        Sign in
      </Link>
    </div>
  );
}
