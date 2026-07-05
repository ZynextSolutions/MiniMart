"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

type ScannerInstance = {
  stop: () => Promise<void>;
  clear?: () => void | Promise<void>;
};

function formatCameraError(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires HTTPS (or localhost). Open the app over a secure connection.";
  }

  if (!(error instanceof DOMException) && !(error instanceof Error)) {
    return "Camera unavailable. Check permissions and try again.";
  }

  const message = error.message.toLowerCase();

  if (error.name === "NotAllowedError") {
    if (message.includes("permissions policy") || message.includes("feature policy")) {
      return "Camera is blocked by browser policy. Reload the page after deploying the latest update.";
    }
    return "Camera access was blocked. Click Allow when prompted, or enable camera for this site in browser settings.";
  }
  if (error.name === "NotFoundError" || message.includes("not found")) {
    return "No camera found on this device.";
  }
  if (error.name === "NotReadableError" || message.includes("in use")) {
    return "Camera is in use by another app. Close it and retry.";
  }

  return error.message || "Camera unavailable. Check permissions and try again.";
}

async function resolveCameraId(): Promise<string | MediaTrackConstraints> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const cameras = await Html5Qrcode.getCameras();

  if (cameras.length > 0) {
    const preferred = cameras.find((camera) =>
      /back|rear|environment/i.test(camera.label),
    );
    return preferred?.id ?? cameras[0].id;
  }

  // No labels until permission granted — request default camera directly.
  return { facingMode: { ideal: "environment" } };
}

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const scannerElementId = useId().replace(/:/g, "");
  const scannerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ScannerInstance | null>(null);
  const scanHandledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);

  const stopScanner = useCallback(async () => {
    const instance = instanceRef.current;
    instanceRef.current = null;
    if (instance) {
      await instance.stop().catch(() => {});
      await Promise.resolve(instance.clear?.()).catch(() => {});
    }
    setActive(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setStarting(true);
    scanHandledRef.current = false;

    try {
      await stopScanner();

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      if (!scannerRef.current) {
        throw new Error("Scanner not ready. Please try again.");
      }

      const cameraIdOrConfig = await resolveCameraId();

      const scanner = new Html5Qrcode(scannerElementId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        useBarCodeDetectorIfSupported: true,
      });

      instanceRef.current = scanner;

      await scanner.start(
        cameraIdOrConfig,
        { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1.777778 },
        (decoded) => {
          const code = decoded.trim();
          if (!code || scanHandledRef.current) return;
          scanHandledRef.current = true;
          void stopScanner();
          onScan(code);
          onOpenChange(false);
        },
        () => {},
      );

      setActive(true);
    } catch (e) {
      await stopScanner();
      setError(formatCameraError(e));
    } finally {
      setStarting(false);
    }
  }, [onOpenChange, onScan, scannerElementId, stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner().catch(() => {});
      setError(null);
      setStarting(false);
      scanHandledRef.current = false;
      return;
    }

    setError(null);
    setActive(false);
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            id={scannerElementId}
            ref={scannerRef}
            className={`min-h-[280px] w-full overflow-hidden rounded-md bg-muted ${error || (!active && !starting) ? "hidden" : ""}`}
          />

          {!active && !starting && !error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
              <Camera className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Tap below to enable the camera. Your browser will ask for permission.
              </p>
              <Button onClick={() => startScanner()} disabled={starting}>
                {starting ? "Starting..." : "Allow camera & scan"}
              </Button>
            </div>
          ) : null}

          {starting && !error ? (
            <p className="text-center text-xs text-muted-foreground">Starting camera...</p>
          ) : null}

          {error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => startScanner()} disabled={starting}>
                  {starting ? "Starting..." : "Retry"}
                </Button>
              </div>
            </div>
          ) : active ? (
            <p className="text-center text-xs text-muted-foreground">
              Point the camera at a barcode or QR code
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
