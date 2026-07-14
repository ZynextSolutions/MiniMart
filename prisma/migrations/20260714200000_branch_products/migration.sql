-- Per-branch assortment + optional price override.
CREATE TABLE "branch_products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "selling_price" DECIMAL(19,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_products_branch_id_variant_id_key"
ON "branch_products"("branch_id", "variant_id");

CREATE INDEX "branch_products_organization_id_branch_id_idx"
ON "branch_products"("organization_id", "branch_id");

CREATE INDEX "branch_products_variant_id_idx"
ON "branch_products"("variant_id");

ALTER TABLE "branch_products"
ADD CONSTRAINT "branch_products_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branch_products"
ADD CONSTRAINT "branch_products_variant_id_fkey"
FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
