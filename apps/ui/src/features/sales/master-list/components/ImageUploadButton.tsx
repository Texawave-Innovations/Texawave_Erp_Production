"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import { Button, useToast } from "@texawave-erp/ui-kit";

/** The API's limits (apps/api/src/modules/sales/master-list/image-upload.ts). */
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg"];

/**
 * Pick a PNG or JPG (≤ 2 MB) and upload it straight away. The type and
 * size are checked here first; the server checks again.
 */
export function ImageUploadButton({
  label,
  ariaLabel,
  onUpload,
  disabled,
}: {
  label: string;
  ariaLabel: string;
  onUpload: (file: File) => Promise<unknown>;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast({ title: "Choose a PNG or JPG image.", variant: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "The image must be 2 MB or smaller.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
      toast({ title: "Image uploaded", variant: "success" });
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not upload the image",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-label={ariaLabel}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    </>
  );
}
