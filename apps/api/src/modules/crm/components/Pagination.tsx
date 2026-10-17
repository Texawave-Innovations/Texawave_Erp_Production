// Shared pagination hook + footer control — extracted from the pattern `Leads.tsx` already used,
// so `Accounts.tsx`/`Contacts.tsx`/`Products.tsx`/`Quotes.tsx` (previously unbounded lists, a
// scale risk flagged in the CRM audit) get the same behavior without re-deriving it per page.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The actual page-clamping/slicing math, with no state of its own — extracted so a page that
 *  needs its own page/pageSize state (e.g. Leads.tsx, which URL-syncs and scroll-restores them)
 *  can still share this instead of re-deriving totalPages/clampedPage/paged independently. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const paged = items.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  );
  return { paged, page: clampedPage, totalPages, total: items.length };
}

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const {
    paged,
    page: clampedPage,
    totalPages,
    total,
  } = paginate(items, page, pageSize);

  return {
    paged,
    page: clampedPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
  };
}

export function PaginationFooter({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalPages,
  total,
}: {
  page: number;
  setPage: (updater: (p: number) => number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  totalPages: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-100">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
          of {total}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setPageSize(Number(v))}
        >
          <SelectTrigger className="h-8 w-[100px] rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-slate-500 px-2">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-lg"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
