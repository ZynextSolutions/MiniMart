type Align = "left" | "center" | "right";

export class EscPosBuilder {
  private chunks: number[] = [];

  private push(...bytes: number[]) {
    this.chunks.push(...bytes);
  }

  private textEncoder = new TextEncoder();

  init(): this {
    this.push(0x1b, 0x40);
    return this;
  }

  align(align: Align): this {
    const n = align === "left" ? 0 : align === "center" ? 1 : 2;
    this.push(0x1b, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  size(width: 1 | 2, height: 1 | 2): this {
    const n = ((width - 1) << 4) | (height - 1);
    this.push(0x1d, 0x21, n);
    return this;
  }

  text(content: string): this {
    this.push(...this.textEncoder.encode(content));
    return this;
  }

  line(content = ""): this {
    if (content) this.text(content);
    this.push(0x0a);
    return this;
  }

  separator(char = "-", width = 32): this {
    return this.line(char.repeat(width));
  }

  /** GS v 0 — raster bit image (monochrome, row-major, MSB first) */
  image(bitmap: Uint8Array, widthPx: number): this {
    const widthBytes = Math.ceil(widthPx / 8);
    const heightPx = Math.floor(bitmap.length / widthBytes);
    this.push(0x1d, 0x76, 0x30, 0x00);
    this.push(widthBytes & 0xff, (widthBytes >> 8) & 0xff);
    this.push(heightPx & 0xff, (heightPx >> 8) & 0xff);
    this.push(...bitmap);
    return this;
  }

  /** ESC/POS QR Code — Model 2 */
  qrcode(data: string, moduleSize = 4): this {
    const encoded = this.textEncoder.encode(data);
    const storeLen = encoded.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    // Select model 2
    this.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Module size
    this.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize);
    // Error correction M
    this.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // Store data
    this.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    this.push(...encoded);
    // Print
    this.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  cut(partial = false): this {
    this.push(0x1d, 0x56, partial ? 1 : 0);
    return this;
  }

  /** Kick cash drawer pin 2 */
  cashDrawer(): this {
    this.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  feed(lines = 3): this {
    this.push(0x1b, 0x64, lines);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/** Convert image URL to 1-bit ESC/POS raster (client-side) */
export async function imageUrlToEscPosBitmap(
  url: string,
  maxWidth = 384,
): Promise<{ bitmap: Uint8Array; widthPx: number } | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const widthBytes = Math.ceil(w / 8);
      const bitmap = new Uint8Array(widthBytes * h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum < 128) {
            const byteIndex = y * widthBytes + Math.floor(x / 8);
            bitmap[byteIndex] |= 0x80 >> (x % 8);
          }
        }
      }
      resolve({ bitmap, widthPx: w });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Send ESC/POS bytes via Web Serial API (Chrome/Edge) */
export async function sendEscPosToSerial(data: Uint8Array): Promise<boolean> {
  if (!("serial" in navigator)) return false;
  try {
    // @ts-expect-error Web Serial API
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable?.getWriter();
    if (!writer) return false;
    await writer.write(data);
    writer.releaseLock();
    await port.close();
    return true;
  } catch {
    return false;
  }
}

/** Trigger browser download of ESC/POS binary */
export function downloadEscPos(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
