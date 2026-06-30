import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { TaxRateService } from "@/features/tax-rates/services/tax-rate.service";
import { TaxRatesPageClient } from "@/features/tax-rates/components/tax-rates-page-client";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";

export default async function TaxRatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.SETTINGS.TAX_MANAGE);

  const [taxRates, taxMode] = await Promise.all([
    TaxRateService.list(session.user.organizationId),
    TaxSettingsService.getTaxMode(session.user.organizationId),
  ]);
  const initialTaxRates = taxRates.map((taxRate) => ({
    id: taxRate.id,
    name: taxRate.name,
    rate: taxRate.rate.toString(),
    isDefault: taxRate.isDefault,
    isActive: taxRate.isActive,
    _count: taxRate._count,
  }));

  return <TaxRatesPageClient initialTaxRates={initialTaxRates} initialTaxMode={taxMode} />;
}
