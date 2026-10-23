"use client";

import { Button, Dialog, Input } from "@texawave-erp/ui-kit";
import { Camera, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** The browser's built-in barcode reader (Chromium / Android Chrome). */
interface DetectedCode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector ?? null
  );
}

export interface CameraScanDialogProps {
  open: boolean;
  onClose: () => void;
  onResult: (code: string) => void;
  title?: string;
  placeholder?: string;
}

/** Camera scan with manual entry always available. The camera uses the
 * browser's own `BarcodeDetector` (no third-party scanner library), so it
 * works wherever that exists; elsewhere — or when the camera is blocked — the
 * manual box (also fine for USB / Bluetooth hardware scanners, which type
 * the code and press Enter) still works. */
export function CameraScanDialog({
  open,
  onClose,
  onResult,
  title = "Scan Barcode / QR Code",
  placeholder = "Enter barcode or QR value manually",
}: CameraScanDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      {open ? (
        <Body onClose={onClose} onResult={onResult} placeholder={placeholder} />
      ) : null}
    </Dialog>
  );
}

function Body({
  onClose,
  onResult,
  placeholder,
}: {
  onClose: () => void;
  onResult: (code: string) => void;
  placeholder: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // The parent re-renders freely; the camera must not restart each time.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  const [manual, setManual] = useState("");
  const [state, setState] = useState<
    "starting" | "scanning" | "unsupported" | "denied"
  >(() => (detectorCtor() ? "starting" : "unsupported"));

  useEffect(() => {
    const Detector = detectorCtor();
    if (!Detector) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;

    (async () => {
      try {
        const supported = (await Detector.getSupportedFormats?.()) ?? [];
        const wanted = [
          "qr_code",
          "code_128",
          "code_39",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "itf",
          "data_matrix",
        ].filter((f) => supported.length === 0 || supported.includes(f));
        const detector = new Detector(wanted.length ? { formats: wanted } : {});
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState("scanning");
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            const first = codes[0]?.rawValue?.trim();
            if (first) {
              stopped = true;
              onResultRef.current(first);
              return;
            }
          } catch {
            /* a frame that cannot be read — try the next one */
          }
          timer = window.setTimeout(() => void tick(), 220);
        };
        void tick();
      } catch {
        if (!stopped) setState("denied");
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = manual.trim();
    if (value) onResult(value);
  }

  return (
    <div className="flex flex-col gap-4">
      {state === "unsupported" ? (
        <p className="rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
          This browser can&apos;t read codes from the camera. Type the code
          below, or scan it with a USB / Bluetooth scanner (it types the code
          and presses Enter).
        </p>
      ) : state === "denied" ? (
        <p className="rounded-lg bg-warning-50 p-3 text-theme-sm text-warning-700 dark:bg-warning-500/10">
          Camera access isn&apos;t available (blocked, no camera, or the page
          isn&apos;t served over HTTPS). Type the code below instead.
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-1/2 w-1/2 rounded-xl border-2 border-white/70" />
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-theme-xs text-white">
            {state === "starting" ? (
              <>
                <Camera className="h-3.5 w-3.5" /> Starting camera…
              </>
            ) : (
              <>
                <ScanLine className="h-3.5 w-3.5" /> Point at a barcode or QR
                code
              </>
            )}
          </div>
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <Input
          aria-label="Code"
          placeholder={placeholder}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          autoFocus={state !== "scanning"}
        />
        <Button type="submit" disabled={!manual.trim()}>
          Search
        </Button>
      </form>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
