"use client";

import { Button, Input, PageHeader, useToast } from "@texawave-erp/ui-kit";
import { ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "../../shared/use-list-controls";
import { useResolveBarcode } from "../hooks";

/** Legacy `ScmBarcodeDashboard`: type (or scan with a USB / Bluetooth
 * handheld scanner, which types the code and presses Enter) a product, batch,
 * serial or document code and jump straight to the matching record. A
 * camera-based scanner is intentionally not part of this ERP. */
export function BarcodeView() {
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<
    { code: string; label: string; type: string }[]
  >([]);
  const resolve = useResolveBarcode();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    try {
      const hit = await resolve.mutateAsync(value);
      setRecent((r) =>
        [{ code: value, label: hit.label, type: hit.type }, ...r].slice(0, 10),
      );
      setCode("");
      router.push(hit.path);
    } catch (err) {
      toast({
        title: errorText(err, `No match for "${value}"`),
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        icon={ScanLine}
        title="Barcode & Scanning"
        description="Scan or type a product, batch, serial or document code to jump straight to it."
      />
      <form onSubmit={submit} className="flex max-w-lg gap-2">
        <Input
          autoFocus
          aria-label="Code"
          placeholder="Scan or type a code..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" loading={resolve.isPending}>
          Find
        </Button>
      </form>
      {recent.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Recently scanned
          </h3>
          <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800/60 dark:border-gray-800 dark:bg-gray-dark">
            {recent.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="font-mono text-theme-xs text-gray-500">
                  {r.code}
                </span>
                <span className="text-theme-sm">{r.label}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {r.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
