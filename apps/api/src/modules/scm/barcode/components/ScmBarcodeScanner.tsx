// Phase 12 / 12b — the one scanner dialog reused everywhere SCM needs to scan or type a code: the
// Barcode dashboard's global scanner, and every workflow-embedded "Scan" button (GRN, Picking,
// Packing, Quality, Returns). A compact, centered modal over the current SCM page — never a
// full-screen camera takeover, per the Phase 12b spec. Camera permission is requested only when
// the person explicitly starts the camera, never on mount/open, and the stream is always torn
// down on stop/close/unmount.
import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Search,
  ScanLine,
  VideoOff,
} from "lucide-react";

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_39,
];

export interface ScmBarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (code: string) => void;
  title?: string;
  placeholder?: string;
}

type CameraPhase =
  "idle" | "starting" | "scanning" | "unavailable" | "success" | "error";

export default function ScmBarcodeScanner({
  open,
  onOpenChange,
  onResult,
  title = "Scan Barcode / QR Code",
  placeholder = "Enter barcode or QR value manually",
}: ScmBarcodeScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setPhase((p) => (p === "success" ? p : "idle"));
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // Camera may have already been torn down (e.g. tab switched away) — nothing to do.
    }
  };

  const startCamera = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setPhase("unavailable");
      setCameraError(
        "This browser does not support camera access. Use manual entry below.",
      );
      return;
    }
    setCameraError(null);
    setPhase("starting");
    try {
      const scanner = new Html5Qrcode(regionId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;
      // Only `facingMode` is passed as an actual camera constraint — an `aspectRatio` constraint
      // here gets sent straight to `getUserMedia()` and several webcams/browsers reject it as
      // unsatisfiable (OverconstrainedError), failing the camera outright. The compact "small
      // box" look is achieved purely with CSS below (fixed square container + object-cover),
      // which works regardless of the camera's native resolution/aspect ratio.
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          setPhase("success");
          void stopCamera();
          window.setTimeout(() => onResult(decodedText.trim()), 300);
        },
        () => {
          /* per-frame "no code found" — expected continuously while aiming, not an error */
        },
      );
      setPhase("scanning");
    } catch (err: unknown) {
      scannerRef.current = null;
      const name = err instanceof Error ? err.name : "";
      const text = err instanceof Error ? err.message : String(err);
      if (name === "NotAllowedError" || /permission/i.test(text)) {
        setPhase("error");
        setCameraError(
          "Camera permission denied. Use manual entry below instead.",
        );
      } else if (
        name === "NotFoundError" ||
        /no camera|not found/i.test(text)
      ) {
        setPhase("unavailable");
        setCameraError(
          "No camera was found on this device. Use manual entry below.",
        );
      } else if (name === "OverconstrainedError") {
        setPhase("error");
        setCameraError(
          "This camera does not support the requested settings. Use manual entry below.",
        );
      } else if (name === "NotReadableError") {
        setPhase("error");
        setCameraError(
          "Camera is already in use by another app. Close it and try again, or use manual entry.",
        );
      } else {
        setPhase("error");
        setCameraError(
          `Could not start the camera${text ? ` (${text})` : ""}. Use manual entry below instead.`,
        );
      }
    }
  };

  const submitManual = () => {
    const value = manualValue.trim();
    if (!value) return;
    onResult(value);
    setManualValue("");
  };

  // Stop the stream whenever the dialog closes, and on unmount — never leave the camera running
  // in the background.
  useEffect(() => {
    if (!open) {
      void stopCamera();
      setCameraError(null);
    }
  }, [open]);
  useEffect(
    () => () => {
      void stopCamera();
    },
    [],
  );

  const cameraActive = phase === "scanning" || phase === "success";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) void stopCamera();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-brand-600" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {phase === "idle" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={startCamera}
              >
                <Camera className="h-4 w-4 mr-2" /> Scan with Camera
              </Button>
            )}
            {phase === "starting" && (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting
                camera...
              </Button>
            )}
            {cameraActive && (
              <Button
                variant="outline"
                className="w-full text-red-600 hover:text-red-700"
                onClick={() => void stopCamera()}
              >
                <CameraOff className="h-4 w-4 mr-2" /> Stop Camera
              </Button>
            )}
            {(phase === "unavailable" || phase === "error") && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <VideoOff className="h-4 w-4 shrink-0" /> {cameraError}
              </div>
            )}

            <div className="relative mx-auto w-full max-w-[260px]">
              <div
                id={regionId}
                className={
                  cameraActive
                    ? "aspect-square w-full overflow-hidden rounded-md border border-border bg-black [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
                    : "hidden"
                }
              />
              {phase === "scanning" && (
                <div className="mt-1.5 text-center text-xs text-muted-foreground">
                  Align the barcode or QR code inside the frame
                </div>
              )}
              {phase === "success" && (
                <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Scanned successfully
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or enter manually{" "}
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Barcode / QR Value</Label>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                }}
                placeholder={placeholder}
              />
              <Button onClick={submitManual} disabled={!manualValue.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
