/**
 * Prints one rendered element (e.g. a MoM or proposal document sheet) through
 * a hidden same-origin iframe that carries the app's stylesheets, so the
 * browser's "Save as PDF" produces exactly what the preview shows — without
 * printing the surrounding app chrome. The `title` becomes the browser's
 * default PDF filename. Replaces the legacy client-side html2pdf export
 * without adding a dependency.
 */
export function printElement(element: HTMLElement, title: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDoc || !frameWindow) {
    iframe.remove();
    window.print();
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join("\n");

  const safeTitle = title.replace(/[<>&"]/g, "");
  frameDoc.open();
  frameDoc.write(
    `<!doctype html><html class="${document.documentElement.className}"><head><meta charset="utf-8" /><title>${safeTitle}</title>${styles}<style>@page { margin: 12mm; } html, body { background: #ffffff !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style></head><body class="${document.body.className}">${element.outerHTML}</body></html>`,
  );
  frameDoc.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  };
  iframe.onload = () => window.setTimeout(doPrint, 250);
  // Stylesheets are usually cached, in which case `load` may already have
  // fired before the handler was attached.
  window.setTimeout(doPrint, 1500);
}

/** `MOM-2026-0001_Rev2_PRJ-000001` style filename segment (legacy
 * `toSafeFilenameSegment`). */
export function safeFilename(
  ...parts: Array<string | number | null | undefined>
): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== "")
    .map((p) =>
      String(p)
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("_");
}
