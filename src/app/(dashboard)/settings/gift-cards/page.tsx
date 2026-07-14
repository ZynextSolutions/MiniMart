import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { prisma } from "@/infrastructure/database/prisma";
import { GiftCardService } from "@/features/gift-cards/services/gift-card.service";
import { GiftCardsClient } from "@/features/gift-cards/components/gift-cards-client";
import { serializeGiftCard } from "@/lib/utils/serialize-prisma";

export default async function GiftCardsSettingsPage() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.CUSTOMERS.VIEW);

  const [cards, customers] = await Promise.all([
    GiftCardService.list(session.user.organizationId),
    prisma.customer.findMany({
      where: { organizationId: session.user.organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gift Cards</h1>
        <p className="text-muted-foreground">Issue and manage gift cards for customers.</p>
      </div>
      <GiftCardsClient cards={cards.map(serializeGiftCard)} customers={customers} />
    </div>
  );
}
