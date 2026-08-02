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
  /** Keep camera open and accept repeated scans (POS). Default false. */
  continuous?: boolean;
}

type CameraOption = {
  id: string;
  label: string;
};

type FacingMode = "environment" | "user";

type StartTarget =
  | { kind: "device"; deviceId: string }
  | { kind: "facing"; facingMode: FacingMode };

const SCAN_COOLDOWN_MS = 1600;
const SAME_CODE_COOLDOWN_MS = 2500;

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

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

function pickPreferredCameraId(cameras: CameraOption[], facing: FacingMode): string | null {
  if (cameras.length === 0) return null;
  if (facing === "environment") {
    const rear = cameras.find((camera) => /back|rear|environment|world/i.test(camera.label));
    if (rear) return rear.id;
  } else {
    const front = cameras.find((camera) => /front|user|face|selfie/i.test(camera.label));
    if (front) return front.id;
  }
  return cameras[0]?.id ?? null;
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function patchVideoElement(root: HTMLElement | null) {
  const video = root?.querySelector("video");
  if (!video) return;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.playsInline = true;
}

async function applyFocusBoost(instance: Html5QrcodeType) {
  try {
    await instance.applyVideoConstraints({
      // Safari / Chromium advanced constraint — ignored when unsupported.
      advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
    });
  } catch {
    // Optional capability.
  }
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScan,
  continuous = false,
}: BarcodeScannerModalProps) {
  const scannerElementId = useId().replace(/:/g, "");
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instanceRef = useRef<Html5QrcodeType | null>(null);
  const scanHandledRef = useRef(false);
  const startTokenRef = useRef(0);
  const startingLockRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onOpenChangeRef = useRef(onOpenChange);
  const continuousRef = useRef(continuous);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const preferredCameraIdRef = useRef<string | null>(null);
  const facingModeRef = useRef<FacingMode>("environment");

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  onScanRef.current = onScan;
  onOpenChangeRef.current = onOpenChange;
  continuousRef.current = continuous;

  const resetControls = useCallback(() => {
    setCameras([]);
    setCameraIndex(0);
    setTorchSupported(false);
    setTorchOn(false);
    setLastScanned(null);
    preferredCameraIdRef.current = null;
    facingModeRef.current = "environment";
    setFacingMode("environment");
    lastScanRef.current = { code: "", at: 0 };
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
        if (currentId && index >= 0) {
          preferredCameraIdRef.current = options[resolvedIndex]?.id ?? null;
        }
      }
    } catch {
      // Enumeration is best-effort after permission is granted.
    }

    try {
      const settings = instance.getRunningTrackSettings();
      const facing = settings.facingMode;
      if (facing === "user" || facing === "environment") {
        facingModeRef.current = facing;
        setFacingMode(facing);
      }
    } catch {
      // Optional.
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
      if (!code) return;

      if (continuousRef.current) {
        const now = Date.now();
        const last = lastScanRef.current;
        if (now - last.at < SCAN_COOLDOWN_MS) return;
        if (code === last.code && now - last.at < SAME_CODE_COOLDOWN_MS) return;

        lastScanRef.current = { code, at: now };
        setLastScanned(code);
        onScanRef.current(code);
        return;
      }

      if (scanHandledRef.current) return;
      scanHandledRef.current = true;
      await stopScanner();
      onScanRef.current(code);
      onOpenChangeRef.current(false);
    },
    [stopScanner],
  );

  const buildScanConfig = useCallback((facing: FacingMode) => {
    const apple = isAppleMobile();

    return {
      fps: apple ? 12 : 10,
      disableFlip: false,
      // Responsive box avoids iOS "qrbox larger than element" failures.
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(Math.min(viewfinderWidth * 0.86, apple ? 300 : 320));
        const height = Math.floor(Math.min(viewfinderHeight * 0.42, apple ? 140 : 170));
        return {
          width: Math.max(180, width),
          height: Math.max(100, height),
        };
      },
      // aspectRatio breaks camera init on many iPhones — omit on Apple.
      ...(apple ? {} : { aspectRatio: 1.777778 }),
      videoConstraints: {
        facingMode: facing,
        width: { ideal: apple ? 1280 : 1280 },
        height: { ideal: apple ? 720 : 720 },
        ...(apple ? {} : { frameRate: { ideal: 15 } }),
      },
    };
  }, []);

  const startScanner = useCallback(
    async (target?: StartTarget) => {
      if (startingLockRef.current) return;
      startingLockRef.current = true;

      const token = ++startTokenRef.current;
      setError(null);
      setStarting(true);
      setActive(false);
      scanHandledRef.current = false;

      try {
        await stopScanner();
        await waitForLayout();

        if (token !== startTokenRef.current) return;
        if (!scannerRef.current) {
          throw new Error("Scanner not ready. Please try again.");
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const apple = isAppleMobile();

        if (target?.kind === "device") {
          preferredCameraIdRef.current = target.deviceId;
        } else if (target?.kind === "facing") {
          facingModeRef.current = target.facingMode;
          setFacingMode(target.facingMode);
          preferredCameraIdRef.current = null;
        }

        const facing = facingModeRef.current;
        const config = buildScanConfig(facing);

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
            // Native detector helps Android; ZXing fallback still used when missing (older iOS).
            useBarCodeDetectorIfSupported: true,
          });

        const onSuccess = (decoded: string) => {
          void handleDecoded(decoded);
        };

        const candidates: Array<string | MediaTrackConstraints> = [];

        if (target?.kind === "device") {
          candidates.push(target.deviceId);
        } else if (preferredCameraIdRef.current) {
          candidates.push(preferredCameraIdRef.current);
        }

        // Facing-mode candidates — critical for iPhone + Android tablets with weak device labels.
        candidates.push(
          { facingMode: { ideal: facing } },
          { facingMode: facing },
        );

        if (facing === "environment") {
          candidates.push({ facingMode: { exact: "environment" } });
        }

        let lastError: unknown;
        let started = false;

        for (const candidate of candidates) {
          if (token !== startTokenRef.current) return;

          const scanner = createScanner();
          instanceRef.current = scanner;

          try {
            // When using facing constraints, also pass videoConstraints for focus/resolution.
            const startConfig =
              typeof candidate === "string"
                ? { fps: config.fps, qrbox: config.qrbox, ...(apple ? {} : { aspectRatio: config.aspectRatio }) }
                : config;

            await scanner.start(candidate, startConfig, onSuccess, () => {});
            started = true;
            if (typeof candidate === "string") {
              preferredCameraIdRef.current = candidate;
            }
            break;
          } catch (err) {
            lastError = err;
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

        // Enumerate devices and retry with preferred id (labels appear after permission).
        if (!started) {
          try {
            const devices = await Html5Qrcode.getCameras();
            const options = devices.map((device, index) => ({
              id: device.id,
              label: device.label || `Camera ${index + 1}`,
            }));
            setCameras(options);
            const fallbackId = pickPreferredCameraId(options, facing);

            if (fallbackId && token === startTokenRef.current) {
              const scanner = createScanner();
              instanceRef.current = scanner;
              await scanner.start(
                fallbackId,
                { fps: config.fps, qrbox: config.qrbox, ...(apple ? {} : { aspectRatio: config.aspectRatio }) },
                onSuccess,
                () => {},
              );
              preferredCameraIdRef.current = fallbackId;
              started = true;
            }
          } catch (err) {
            lastError = err;
          }
        }

        // Last resort: empty constraints + videoConstraints only (some iOS builds).
        if (!started && token === startTokenRef.current) {
          try {
            const scanner = createScanner();
            instanceRef.current = scanner;
            await scanner.start(
              {},
              {
                fps: config.fps,
                qrbox: config.qrbox,
                videoConstraints: {
                  facingMode: facing,
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              onSuccess,
              () => {},
            );
            started = true;
          } catch (err) {
            lastError = err;
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

        patchVideoElement(scannerRef.current);
        await applyFocusBoost(instance);
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
    [buildScanConfig, handleDecoded, refreshDeviceControls, resetControls, scannerElementId, stopScanner],
  );

  const switchCamera = useCallback(async () => {
    if (startingLockRef.current) return;

    // Prefer cycling real devices when the OS exposes more than one.
    if (cameras.length > 1) {
      const nextIndex = (cameraIndex + 1) % cameras.length;
      const next = cameras[nextIndex];
      setCameraIndex(nextIndex);
      const label = next.label.toLowerCase();
      const nextFacing: FacingMode = /front|user|face|selfie/.test(label)
        ? "user"
        : "environment";
      facingModeRef.current = nextFacing;
      setFacingMode(nextFacing);
      await startScanner({ kind: "device", deviceId: next.id });
      return;
    }

    // Android tablets / iPhones often report one device or unlabeled cams —
    // toggle facingMode so Switch camera still works.
    const nextFacing: FacingMode =
      facingModeRef.current === "environment" ? "user" : "environment";
    preferredCameraIdRef.current = null;
    await startScanner({ kind: "facing", facingMode: nextFacing });
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

        if (continuousRef.current) {
          await handleDecoded(decoded);
          // Resume live camera after photo scan in continuous mode.
          startingLockRef.current = false;
          setScanningFile(false);
          await startScanner(
            preferredCameraIdRef.current
              ? { kind: "device", deviceId: preferredCameraIdRef.current }
              : { kind: "facing", facingMode: facingModeRef.current },
          );
          return;
        }

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
    [handleDecoded, scannerElementId, startScanner, stopScanner],
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
          <DialogTitle>{continuous ? "Scan items" : "Scan Barcode"}</DialogTitle>
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

          <div className="relative min-h-[280px] w-full overflow-hidden rounded-md bg-muted [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
            <div id={scannerElementId} ref={scannerRef} className="min-h-[280px] w-full" />

            {showIdle ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border border-dashed bg-background p-6 text-center">
                <Camera className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {continuous
                    ? "Enable the camera once, then keep scanning items without closing."
                    : "Tap below to enable the camera. Your browser will ask for permission."}
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
                {continuous
                  ? "Keep pointing at barcodes — items add automatically. Close when done."
                  : "Point the camera at a barcode or QR code"}
              </p>
              {continuous && lastScanned ? (
                <p className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Last scan: {lastScanned}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-center gap-2">
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
                {continuous ? (
                  <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                ) : null}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                {cameras.length > 1
                  ? `Using ${cameras[cameraIndex]?.label ?? "camera"}`
                  : facingMode === "environment"
                    ? "Using rear camera"
                    : "Using front camera"}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
