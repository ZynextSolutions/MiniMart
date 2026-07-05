import { prisma } from "@/infrastructure/database/prisma";
import { ValidationError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import {
  ACCOUNT_MAPPING_FIELD_LABELS,
  ACCOUNT_MAPPING_KEYS,
  ACCOUNT_MAPPING_SETTING_KEY,
  DEFAULT_ACCOUNT_MAPPING,
  parseAccountMapping,
  type AccountMapping,
  type AccountMappingKey,
} from "@/platform/onboarding/default-account-mapping";

export class AccountMappingService {
  static async getAccountMapping(organizationId: string): Promise<AccountMapping> {
    const setting = await prisma.setting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
    });

    const parsed = parseAccountMapping(setting?.value);
    if (parsed) return parsed;

    await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
      create: {
        organizationId,
        key: ACCOUNT_MAPPING_SETTING_KEY,
        value: DEFAULT_ACCOUNT_MAPPING,
      },
      update: {
        value: DEFAULT_ACCOUNT_MAPPING,
      },
    });

    return { ...DEFAULT_ACCOUNT_MAPPING };
  }

  static async setAccountMapping(
    organizationId: string,
    mapping: AccountMapping,
    userId: string,
  ): Promise<AccountMapping> {
    await this.validateAccountMapping(organizationId, mapping);

    const before = await prisma.setting.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
    });

    const setting = await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
      create: {
        organizationId,
        key: ACCOUNT_MAPPING_SETTING_KEY,
        value: mapping,
      },
      update: {
        value: mapping,
      },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "settings.account-mapping.updated",
      entityType: "Setting",
      entityId: setting.id,
      before: before?.value ?? null,
      after: mapping,
    });

    return mapping;
  }

  static async validateAccountMapping(
    organizationId: string,
    mapping: AccountMapping,
  ): Promise<void> {
    for (const key of ACCOUNT_MAPPING_KEYS) {
      const code = mapping[key];
      if (!code?.trim()) {
        throw new ValidationError(
          `Account mapping "${ACCOUNT_MAPPING_FIELD_LABELS[key].label}" is required`,
        );
      }
    }

    const codes = [...new Set(Object.values(mapping))];
    const accounts = await prisma.account.findMany({
      where: {
        organizationId,
        code: { in: codes },
        deletedAt: null,
        isActive: true,
      },
      select: { code: true },
    });

    const found = new Set(accounts.map((account) => account.code));
    for (const key of ACCOUNT_MAPPING_KEYS) {
      const code = mapping[key];
      if (!found.has(code)) {
        throw new ValidationError(
          `Account mapping "${ACCOUNT_MAPPING_FIELD_LABELS[key].label}": active account ${code} not found`,
        );
      }
    }
  }

  static async listActiveAccounts(organizationId: string) {
    return prisma.account.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });
  }

  static mappingKeys(): AccountMappingKey[] {
    return [...ACCOUNT_MAPPING_KEYS];
  }
}
