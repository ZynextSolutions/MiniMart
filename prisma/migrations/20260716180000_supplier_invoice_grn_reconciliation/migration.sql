-- CreateEnum
CREATE TYPE "GrnInvoicingStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECONCILED');

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "invoicing_status" "GrnInvoicingStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN "invoiced_qty" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "supplier_invoices" ADD COLUMN "goods_receipt_id" UUID;
ALTER TABLE "supplier_invoices" ADD COLUMN "purchase_order_id" UUID;
ALTER TABLE "supplier_invoices" ADD COLUMN "reconciliation_status" "GrnInvoicingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "supplier_invoices" ADD COLUMN "grn_subtotal" DECIMAL(19,4);
ALTER TABLE "supplier_invoices" ADD COLUMN "variance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "supplier_invoice_lines" ADD COLUMN "goods_receipt_line_id" UUID;
ALTER TABLE "supplier_invoice_lines" ADD COLUMN "grn_unit_cost" DECIMAL(19,4);
ALTER TABLE "supplier_invoice_lines" ADD COLUMN "variance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_goods_receipt_id_fkey"
  FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines"
  ADD CONSTRAINT "supplier_invoice_lines_goods_receipt_line_id_fkey"
  FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "supplier_invoices_goods_receipt_id_idx" ON "supplier_invoices"("goods_receipt_id");

-- Backfill PPV account for existing organizations
INSERT INTO "accounts" (
  "id",
  "organization_id",
  "code",
  "name",
  "type",
  "subtype",
  "is_system",
  "is_active",
  "normal_balance",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  o."id",
  '5150',
  'Purchase Price Variance',
  'EXPENSE'::"AccountType",
  'OTHER'::"AccountSubtype",
  true,
  true,
  'DEBIT',
  NOW(),
  NOW()
FROM "organizations" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "accounts" a
  WHERE a."organization_id" = o."id"
    AND a."code" = '5150'
    AND a."deleted_at" IS NULL
);

-- Mark existing GRNs with linked invoices as reconciled (best-effort legacy)
UPDATE "goods_receipts" gr
SET "invoicing_status" = 'RECONCILED'
WHERE EXISTS (
  SELECT 1 FROM "supplier_invoices" si
  WHERE si."goods_receipt_id" = gr."id"
);
