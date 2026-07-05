import { PrismaClient } from "@prisma/client";
import {
  ACCOUNT_MAPPING_SETTING_KEY,
  DEFAULT_ACCOUNT_MAPPING,
} from "../src/platform/onboarding/default-account-mapping";

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  let created = 0;
  let skipped = 0;

  for (const org of orgs) {
    const existing = await prisma.setting.findUnique({
      where: {
        organizationId_key: {
          organizationId: org.id,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
    });

    if (existing?.value) {
      skipped += 1;
      continue;
    }

    await prisma.setting.upsert({
      where: {
        organizationId_key: {
          organizationId: org.id,
          key: ACCOUNT_MAPPING_SETTING_KEY,
        },
      },
      create: {
        organizationId: org.id,
        key: ACCOUNT_MAPPING_SETTING_KEY,
        value: DEFAULT_ACCOUNT_MAPPING,
      },
      update: {
        value: DEFAULT_ACCOUNT_MAPPING,
      },
    });

    created += 1;
    console.log(`Created account_mapping for ${org.slug} (${org.name})`);
  }

  console.log(`Done. Created: ${created}, skipped (already set): ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
