import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BarcodeQueryService } from "@/features/barcode/services/barcode-query.service";
import { LabelDesignerClient } from "@/features/barcode/components/label-designer-client";

export default async function BarcodePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.BARCODE.GENERATE);

  const products = await BarcodeQueryService.listProductsForLabels(session.user.organizationId);

  const initialProducts = products.map((p) => {
    const bc = p.barcodes[0] ?? p.variants[0]?.barcodes[0];
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.sellingPrice),
      barcode: bc?.code ?? p.sku,
      barcodeType: bc?.type ?? "CODE128",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Barcode & Labels</h1>
        <p className="text-muted-foreground">
          Generate Code128, EAN13, and QR codes. Design and print product labels.
        </p>
      </div>
      <LabelDesignerClient initialProducts={initialProducts} />
    </div>
  );
}
