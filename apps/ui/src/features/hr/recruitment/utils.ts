"use client";

import { ApiError } from "@texawave-erp/core";
import { useEffect, useState } from "react";

/** Message for a failed call. A 400 carries the backend's own validation
 * messages, which are shown as they come back. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.isValidationError) return error.fieldErrors.join(". ");
    if (error.isPermissionError) {
      return "You do not have permission to do this.";
    }
    if (error.isNotFound) {
      return "This record was not found. It may have been removed.";
    }
    return error.message || fallback;
  }
  return fallback;
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Formats a `YYYY-MM-DD` date for display, without a timezone shift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Formats a decimal string as Indian-grouped rupees, e.g. ₹ 1,23,456.00. */
export function formatRupees(value: string | null | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `₹ ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Adds whole days to a `YYYY-MM-DD` string (UTC, so no DST drift). */
export function addDaysToDateOnly(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Browser-native high-fidelity print / "Save as PDF" for official offer letters.
 * Spawns an isolated invisible iframe containing only the A4 document pages,
 * inherits all compiled stylesheets and font declarations, and triggers
 * the native print dialog. This eliminates any app chrome, navbars, forms, or headers
 * from the print output.
 */
export function printOfferLetter(
  targetElementOrId?: HTMLElement | string | null,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const element: HTMLElement | null =
    typeof targetElementOrId === "string"
      ? document.getElementById(targetElementOrId)
      : (targetElementOrId ??
        document.getElementById("offer-letter-printable-content") ??
        document.querySelector(".printable-doc-root"));

  if (!element) {
    window.print();
    return false;
  }

  // Remove any previous print iframes
  const staleIframe = document.getElementById("offer-letter-print-iframe");
  if (staleIframe) {
    staleIframe.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "offer-letter-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return false;
  }

  // Clone document element
  const clone = element.cloneNode(true) as HTMLElement;

  // Ensure all pages (Page 1 and Page 2) inside the cloned document are visible
  clone.querySelectorAll(".doc-page").forEach((page) => {
    (page as HTMLElement).classList.remove("hidden");
    (page as HTMLElement).style.display = "flex";
  });

  // Remove any on-screen controls or buttons inside the clone
  clone.querySelectorAll(".no-print").forEach((el) => {
    el.remove();
  });

  // Collect all stylesheets and style blocks from current page
  const headElements: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    headElements.push(node.outerHTML);
  });

  // Exact A4 CSS rules
  const printStyles = `
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #111827 !important;
      font-family: 'Nunito Sans', var(--font-sans), system-ui, -apple-system, sans-serif !important;
    }
    .printable-doc-root {
      width: 210mm !important;
      margin: 0 auto !important;
      padding: 0 !important;
      display: block !important;
    }
    .doc-page {
      width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      page-break-after: always !important;
      page-break-inside: avoid !important;
      break-after: page !important;
      break-inside: avoid !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background-color: #ffffff !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    .doc-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .no-print {
      display: none !important;
    }
  `;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Offer Letter - Texawave Innovations</title>
    ${headElements.join("\n")}
    <style>${printStyles}</style>
  </head>
  <body class="bg-white">
    <div class="printable-doc-root">
      ${clone.innerHTML}
    </div>
  </body>
</html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }
  }, 350);

  return true;
}

