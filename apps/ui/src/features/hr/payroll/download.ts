/** Saves a Blob as a file through a temporary object URL. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Saves text (by default CSV) as a file. */
export function downloadText(
  fileName: string,
  content: string,
  type = "text/csv;charset=utf-8",
): void {
  downloadBlob(fileName, new Blob([content], { type }));
}
