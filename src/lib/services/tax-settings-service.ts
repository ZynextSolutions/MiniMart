import { prisma } from "@/infrastructure/database/prisma";
import type { TaxMode } from "@/lib/utils/tax";

const TAX_MODE_SETTING_KEY = "tax_mode";
const DEFAULT_TAX_MODE: TaxMode = "EXCLUSIVE";

function parseTaxMode(value: unknown): TaxMode | null {
  if (typeof value !== "object" || value === null) return null;
  const mode = (value as { mode?: unknown }).mode;
  return mode === "INCLUSIVE" || mode === "EXCLUSIVE" ? mode : null;
}

export class TaxSettingsService {
  static async getTaxMode(organizationId: string): Promise<TaxMode> {
    const setting = await prisma.setting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: TAX_MODE_SETTING_KEY,
        },
      },
    });

    const parsedMode = parseTaxMode(setting?.value);
    if (parsedMode) return parsedMode;

    await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: TAX_MODE_SETTING_KEY,
        },
      },
      create: {
        organizationId,
        key: TAX_MODE_SETTING_KEY,
        value: { mode: DEFAULT_TAX_MODE },
      },
      update: {
        value: { mode: DEFAULT_TAX_MODE },
      },
    });

    return DEFAULT_TAX_MODE;
  }

  static async setTaxMode(organizationId: string, mode: TaxMode) {
    return prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: TAX_MODE_SETTING_KEY,
        },
      },
      create: {
        organizationId,
        key: TAX_MODE_SETTING_KEY,
        value: { mode },
      },
      update: {
        value: { mode },
      },
    });
  }
}

