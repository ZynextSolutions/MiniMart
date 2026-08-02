"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, Flashlight, FlashlightOff, ImageIcon, SwitchCamera } from "lucide-react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";
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

type CameraOption = {
  id: string;
  label: string;
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

function errorTips(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("https")) {
    return "Use https:// or http://localhost — browsers block camera on insecure origins.";
  }
  if (lower.includes("blocked") || lower.includes("permission")) {
    return "Check the lock icon in the address bar → Site settings → Camera → Allow.";
  }
  if (lower.includes("in use")) {
    return "Close Zoom, Meet, or other apps using the camera, then retry.";
  }
  return "You can also scan from a photo if the camera is unavailable.";
}

function pickPreferredCameraId(cameras: CameraOption[]): string | null {
  if (cameras.length === 0) return null;
  const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
  return preferred?.id ?? cameras[0].id;
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const scannerElementId = useId().replace(/:/g, "");
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instanceRef = useRef<Html5QrcodeType | null>(null);
  const scanHandledRef = useRef(false);
  const startTokenRef = useRef(0);
  const startingLockRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onOpenChangeRef = useRef(onOpenChange);
  const preferredCameraIdRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  onScanRef.current = onScan;
  onOpenChangeRef.current = onOpenChange;

  const resetControls = useCallback(() => {
    setCameras([]);
    setCameraIndex(0);
    setTorchSupported(false);
    setTorchOn(false);
    preferredCameraIdRef.current = null;
  }, []);

  const stopScanner = useCallback(async () => {
    const instance = instanceRef.current;
    instanceRef.current = null;
    if (instance) {
      if (instance.isScanning) {
        await instance.stop().catch(() => {});
      }
      try {
        instance.clear();
      } catch {
        // Element may already be unmounted.
      }
    }
    setActive(false);
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const refreshDeviceControls = useCallback(async (instance: Html5QrcodeType) => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const devices = await Html5Qrcode.getCameras();
      const options = devices.map((device, index) => ({
        id: device.id,
        label: device.label || `Camera ${index + 1}`,
      }));
      setCameras(options);

      if (options.length > 0) {
        const currentId = preferredCameraIdRef.current;
        const index = currentId
          ? options.findIndex((camera) => camera.id === currentId)
          : -1;
        const resolvedIndex = index >= 0 ? index : 0;
        setCameraIndex(resolvedIndex);
        preferredCameraIdRef.current = options[resolvedIndex]?.id ?? null;
      }
    } catch {
      // Enumeration is best-effort after permission is granted.
    }

    try {
      const torch = instance.getRunningTrackCameraCapabilities().torchFeature();
      const supported = torch.isSupported();
      setTorchSupported(supported);
      setTorchOn(Boolean(torch.value()));
    } catch {
      setTorchSupported(false);
      setTorchOn(false);
    }
  }, []);

  const handleDecoded = useCallback(
    async (decoded: string) => {
      const code = decoded.trim();
      if (!code || scanHandledRef.current) return;
      scanHandledRef.current = true;
      await stopScanner();
      onScanRef.current(code);
      onOpenChangeRef.current(false);
    },
    [stopScanner],
  );

  const startScanner = useCallback(
    async (cameraIdOverride?: string) => {
      if (startingLockRef.current) return;
      startingLockRef.current = true;

      const token = ++startTokenRef.current;
      setError(null);
      setStarting(true);
      setActive(false);
      scanHandledRef.current = false;

      try {
        await stopScanner();
        // Allow React to paint the in-flow preview before getUserMedia.
        await waitForLayout();

        if (token !== startTokenRef.current) return;
        if (!scannerRef.current) {
          throw new Error("Scanner not ready. Please try again.");
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

        const createScanner = () =>
          new Html5Qrcode(scannerElementId, {
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

        const config = { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1.777778 };
        const onSuccess = (decoded: string) => {
          void handleDecoded(decoded);
        };

        const candidates: Array<string | MediaTrackConstraints> = [];
        if (cameraIdOverride) {
          preferredCameraIdRef.current = cameraIdOverride;
          candidates.push(cameraIdOverride);
        } else if (preferredCameraIdRef.current) {
          candidates.push(preferredCameraIdRef.current);
        } else {
          candidates.push({ facingMode: { ideal: "environment" } });
        }

        let lastError: unknown;
        let started = false;

        for (const candidate of candidates) {
          if (token !== startTokenRef.current) return;

          const scanner = createScanner();
          instanceRef.current = scanner;

          try {
            await scanner.start(candidate, config, onSuccess, () => {});
            started = true;
            if (typeof candidate === "string") {
              preferredCameraIdRef.current = candidate;
            }
            break;
          } catch (error) {
            lastError = error;
            instanceRef.current = null;
            if (scanner.isScanning) {
              await scanner.stop().catch(() => {});
            }
            try {
              scanner.clear();
            } catch {
              // ignore
            }
          }
        }

        // If facingMode failed, try an enumerated device id once.
        if (!started && !cameraIdOverride) {
          try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const devices = await Html5Qrcode.getCameras();
            const fallbackId = pickPreferredCameraId(
              devices.map((device, index) => ({
                id: device.id,
                label: device.label || `Camera ${index + 1}`,
              })),
            );

            if (fallbackId && token === startTokenRef.current) {
              const scanner = createScanner();
              instanceRef.current = scanner;
              await scanner.start(fallbackId, config, onSuccess, () => {});
              preferredCameraIdRef.current = fallbackId;
              started = true;
            }
          } catch (error) {
            lastError = error;
          }
        }

        if (!started) {
          throw lastError ?? new Error("Camera unavailable. Check permissions and try again.");
        }

        if (token !== startTokenRef.current) {
          await stopScanner();
          return;
        }

        const instance = instanceRef.current;
        if (!instance) {
          throw new Error("Camera unavailable. Check permissions and try again.");
        }

        setActive(true);
        await refreshDeviceControls(instance);
      } catch (e) {
        if (token !== startTokenRef.current) return;
        await stopScanner();
        setError(formatCameraError(e));
        resetControls();
      } finally {
        if (token === startTokenRef.current) {
          setStarting(false);
        }
        startingLockRef.current = false;
      }
    },
    [handleDecoded, refreshDeviceControls, resetControls, scannerElementId, stopScanner],
  );

  const switchCamera = useCallback(async () => {
    if (cameras.length < 2 || startingLockRef.current) return;
    const nextIndex = (cameraIndex + 1) % cameras.length;
    const next = cameras[nextIndex];
    setCameraIndex(nextIndex);
    preferredCameraIdRef.current = next.id;
    await startScanner(next.id);
  }, [cameraIndex, cameras, startScanner]);

  const toggleTorch = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance || !torchSupported) return;

    try {
      const torch = instance.getRunningTrackCameraCapabilities().torchFeature();
      if (!torch.isSupported()) {
        setTorchSupported(false);
        return;
      }
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch {
      setError("Torch is not available on this camera.");
      setTorchSupported(false);
      setTorchOn(false);
    }
  }, [torchOn, torchSupported]);

  const scanFromFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file containing a barcode or QR code.");
        return;
      }

      const token = ++startTokenRef.current;
      setScanningFile(true);
      setError(null);
      scanHandledRef.current = false;

      try {
        await stopScanner();
        await waitForLayout();

        if (token !== startTokenRef.current) return;

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
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
        const decoded = await scanner.scanFile(file, false);
        if (token !== startTokenRef.current) return;
        await handleDecoded(decoded);
      } catch (e) {
        if (token !== startTokenRef.current) return;
        await stopScanner();
        const message = e instanceof Error ? e.message.toLowerCase() : "";
        setError(
          message.includes("not found") ||
            message.includes("no multi") ||
            message.includes("no barcode") ||
            message.includes("qr code parse")
            ? "No barcode found in that image. Try a clearer, well-lit photo."
            : formatCameraError(e),
        );
      } finally {
        if (token === startTokenRef.current) {
          setScanningFile(false);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [handleDecoded, scannerElementId, stopScanner],
  );

  useEffect(() => {
    if (!open) {
      startTokenRef.current += 1;
      startingLockRef.current = false;
      stopScanner().catch(() => {});
      setError(null);
      setStarting(false);
      setScanningFile(false);
      scanHandledRef.current = false;
      resetControls();
    }
  }, [open, resetControls, stopScanner]);

  const busy = starting || scanningFile;
  const showIdle = !active && !starting && !error && !scanningFile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void scanFromFile(file);
            }}
          />

          <div className="relative min-h-[280px] w-full overflow-hidden rounded-md bg-muted">
            {/* Keep host in-flow while dialog is open so getUserMedia can size the video. */}
            <div id={scannerElementId} ref={scannerRef} className="min-h-[280px] w-full" />

            {showIdle ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border border-dashed bg-background p-6 text-center">
                <Camera className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Tap below to enable the camera. Your browser will ask for permission.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => void startScanner()} disabled={busy}>
                    Allow camera & scan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                  >
                    <ImageIcon className="mr-1 h-4 w-4" />
                    Scan from photo
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground">{errorTips(error)}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={() => void startScanner()} disabled={busy}>
                    {starting ? "Starting..." : "Retry camera"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                  >
                    <ImageIcon className="mr-1 h-4 w-4" />
                    Scan from photo
                  </Button>
                </div>
              </div>
            ) : null}

            {(starting || scanningFile) && !error ? (
              <div className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-center text-xs text-muted-foreground">
                {scanningFile ? "Reading barcode from photo..." : "Starting camera..."}
              </div>
            ) : null}
          </div>

          {active ? (
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                Point the camera at a barcode or QR code
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {cameras.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void switchCamera()}
                    disabled={busy}
                  >
                    <SwitchCamera className="mr-1 h-4 w-4" />
                    Switch camera
                  </Button>
                ) : null}
                {torchSupported ? (
                  <Button
                    type="button"
                    variant={torchOn ? "default" : "outline"}
                    size="sm"
                    onClick={() => void toggleTorch()}
                    disabled={busy}
                  >
                    {torchOn ? (
                      <FlashlightOff className="mr-1 h-4 w-4" />
                    ) : (
                      <Flashlight className="mr-1 h-4 w-4" />
                    )}
                    {torchOn ? "Torch off" : "Torch"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <ImageIcon className="mr-1 h-4 w-4" />
                  Photo
                </Button>
              </div>
              {cameras.length > 1 ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  Using {cameras[cameraIndex]?.label ?? "camera"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
