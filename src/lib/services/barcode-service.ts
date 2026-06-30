import { prisma } from "@/infrastructure/database/prisma";
import { BarcodeType } from "@prisma/client";
import { BarcodeImageService } from "@/lib/services/barcode-image-service";

export class BarcodeService {
  static async generateInternalCode(organizationId: string): Promise<string> {
    const count = await prisma.productBarcode.count();
    const seq = String(count + 1).padStart(8, "0");
    const orgPrefix = organizationId.replace(/-/g, "").slice(0, 4).toUpperCase();
    return `${orgPrefix}${seq}`;
  }

  static async generateEAN13(): Promise<string> {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return base + check;
  }

  static validateEAN13(code: string): boolean {
    return BarcodeImageService.validateEAN13(code);
  }

  static validateCode128(code: string): boolean {
    return BarcodeImageService.validateCode128(code);
  }

  static computeEAN13CheckDigit(base12: string): string {
    return BarcodeImageService.ean13CheckDigit(base12);
  }

  static mapBarcodeType(type: string): BarcodeType {
    switch (type) {
      case "EAN13":
        return BarcodeType.EAN13;
      case "QR":
        return BarcodeType.QR;
      case "INTERNAL":
        return BarcodeType.INTERNAL;
      default:
        return BarcodeType.CODE128;
    }
  }
}
