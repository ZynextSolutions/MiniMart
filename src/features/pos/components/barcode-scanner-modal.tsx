"use client";

import { useEffect, useRef, useState } from "react";
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

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!open) {
      instanceRef.current?.stop().catch(() => {});
      instanceRef.current = null;
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !scannerRef.current) return;

        const scanner = new Html5Qrcode("pos-barcode-scanner");
        instanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decoded) => {
            onScan(decoded);
            onOpenChange(false);
          },
          () => {},
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    }

    start();

    return () => {
      cancelled = true;
      instanceRef.current?.stop().catch(() => {});
      instanceRef.current = null;
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="space-y-2 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div id="pos-barcode-scanner" ref={scannerRef} className="w-full overflow-hidden rounded-md" />
        )}
      </DialogContent>
    </Dialog>
  );
}
