import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL ?? "superadmin@platform.com").toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!password) {
    console.error("Set PLATFORM_ADMIN_PASSWORD before running this script.");
    console.error('Example: PLATFORM_ADMIN_PASSWORD=\'YourNewPassword123\' npm run db:reset-platform-admin');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.platformUser.findFirst({ where: { email } });
  if (!existing) {
    console.error(`No platform user found for email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformUser.update({
    where: { id: existing.id },
    data: { passwordHash, isActive: true },
  });

  console.log(`Platform admin password updated for ${email}`);
  console.log("Sign in at /platform-login with the new password.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
