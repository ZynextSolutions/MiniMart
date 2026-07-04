-- Drop global idempotency unique indexes
DROP INDEX IF EXISTS "sales_idempotency_key_key";
DROP INDEX IF EXISTS "journal_entries_idempotency_key_key";

-- Add composite org-scoped idempotency unique indexes
CREATE UNIQUE INDEX "sales_organization_id_idempotency_key_key"
  ON "sales"("organization_id", "idempotency_key");

CREATE UNIQUE INDEX "journal_entries_organization_id_idempotency_key_key"
  ON "journal_entries"("organization_id", "idempotency_key");
