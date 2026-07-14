import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { CouponAdminService, PromotionService } from "@/features/promotions/services/promotion.service";
import { PromotionsClient } from "@/features/promotions/components/promotions-client";
import { serializePromotion } from "@/lib/utils/serialize-prisma";

export default async function PromotionsSettingsPage() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.COMPANY_VIEW);

  const [promotions, coupons] = await Promise.all([
    PromotionService.list(session.user.organizationId),
    CouponAdminService.list(session.user.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Promotions & Coupons</h1>
        <p className="text-muted-foreground">Manage discounts and coupon codes for POS.</p>
      </div>
      <PromotionsClient
        promotions={promotions.map(serializePromotion)}
        coupons={coupons.map(serializePromotion)}
      />
    </div>
  );
}
