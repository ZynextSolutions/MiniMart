-- Add warehouse scoping to FIFO batches
ALTER TABLE "product_batches" ADD COLUMN "warehouse_id" UUID;

UPDATE "product_batches" pb
SET "warehouse_id" = (
  SELECT sl."warehouse_id"
  FROM "stock_levels" sl
  WHERE sl."variant_id" = pb."variant_id"
  ORDER BY sl."quantity" DESC
  LIMIT 1
);

UPDATE "product_batches" pb
SET "warehouse_id" = (
  SELECT w."id"
  FROM "warehouses" w
  INNER JOIN "product_variants" pv ON pv."id" = pb."variant_id"
  INNER JOIN "products" p ON p."id" = pv."product_id"
  WHERE w."organization_id" = p."organization_id"
    AND w."deleted_at" IS NULL
  ORDER BY w."is_default" DESC, w."created_at" ASC
  LIMIT 1
)
WHERE pb."warehouse_id" IS NULL;

ALTER TABLE "product_batches" ALTER COLUMN "warehouse_id" SET NOT NULL;

ALTER TABLE "product_batches"
  ADD CONSTRAINT "product_batches_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "product_batches_variant_id_expiry_date_idx";

CREATE INDEX "product_batches_variant_id_warehouse_id_expiry_date_idx"
  ON "product_batches"("variant_id", "warehouse_id", "expiry_date");
