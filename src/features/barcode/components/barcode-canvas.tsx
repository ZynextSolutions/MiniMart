"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { BarcodeFormat } from "@/lib/services/barcode-image-service";

interface BarcodeCanvasProps {
  value: string;
  format: BarcodeFormat;
  className?: string;
  height?: number;
}

export function BarcodeCanvas({ value, format, className, height = 50 }: BarcodeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value) return;

    if (format === "QR") {
      if (!canvasRef.current) return;
      import("qrcode").then((QRCode) => {
        QRCode.toCanvas(canvasRef.current!, value, { width: height * 2, margin: 1 });
      });
      return;
    }

    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: format === "EAN13" ? "EAN13" : "CODE128",
        width: 1.5,
        height,
        displayValue: true,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      svgRef.current.innerHTML = "";
    }
  }, [value, format, height]);

  if (format === "QR") {
    return <canvas ref={canvasRef} className={className} />;
  }

  return <svg ref={svgRef} className={className} />;
}

/** Export barcode as PNG data URL for print sheets */
export async function barcodeToDataUrl(
  value: string,
  format: BarcodeFormat,
): Promise<string> {
  if (format === "QR") {
    const QRCode = await import("qrcode");
    return QRCode.toDataURL(value, { width: 160, margin: 1 });
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: format === "EAN13" ? "EAN13" : "CODE128",
    width: 1.5,
    height: 50,
    displayValue: true,
    fontSize: 12,
    margin: 4,
  });

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const img = new Image();
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}
