"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
};

function formatCameraError(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires HTTPS (or localhost). Open the app over a secure connection.";
  }

  if (!(error instanceof Error)) {
    return "Camera unavailable. Check permissions and try again.";
  }

  const message = error.message.toLowerCase();
  if (error.name === "NotAllowedError" || message.includes("permission")) {
    return "Camera permission denied. Allow camera access in your browser settings, then retry.";
  }
  if (error.name === "NotFoundError" || message.includes("not found")) {
    return "No camera found on this device.";
  }
  if (error.name === "NotReadableError" || message.includes("in use")) {
    return "Camera is in use by another app. Close it and retry.";
  }

  return error.message || "Camera unavailable. Check permissions and try again.";
}

async function resolveCameraId(
  getCameras: () => Promise<Array<{ id: string; label: string }>>,
): Promise<string> {
  const cameras = await getCameras();
  if (cameras.length === 0) {
    throw new Error("No camera found on this device.");
  }

  const preferred = cameras.find((camera) =>
    /back|rear|environment/i.test(camera.label),
  );
  return preferred?.id ?? cameras[0].id;
}

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const scannerElementId = useId().replace(/:/g, "");
  const scannerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ScannerInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopScanner = useCallback(async () => {
    const instance = instanceRef.current;
    instanceRef.current = null;
    if (instance) {
      await instance.stop().catch(() => {});
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setStarting(true);

    try {
      await stopScanner();

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      if (!scannerRef.current) {
        throw new Error("Scanner not ready. Please try again.");
      }

      const cameraId = await resolveCameraId(() => Html5Qrcode.getCameras());

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
        cameraId,
        { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1.777778 },
        (decoded) => {
          onScan(decoded);
          onOpenChange(false);
        },
        () => {},
      );
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
      return;
    }

    setError(null);

    const timer = window.setTimeout(() => {
      startScanner().catch(() => {});
    }, 150);

    return () => {
      window.clearTimeout(timer);
      stopScanner().catch(() => {});
    };
  }, [open, startScanner, stopScanner]);

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
            className={`min-h-[280px] w-full overflow-hidden rounded-md bg-muted ${error ? "hidden" : ""}`}
          />

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
          ) : starting ? (
            <p className="text-center text-sm text-muted-foreground">Starting camera...</p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Point the camera at a barcode or QR code
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
