-- Add organization-level owner reference.
ALTER TABLE "organizations"
ADD COLUMN "owner_user_id" UUID;

-- Backfill owner from legacy Owner role assignments (earliest active Owner by created_at).
UPDATE "organizations" AS org
SET "owner_user_id" = legacy."user_id"
FROM (
  SELECT DISTINCT ON (u."organization_id")
    u."organization_id",
    u."id" AS "user_id"
  FROM "user_branch_roles" AS ubr
  INNER JOIN "roles" AS r
    ON r."id" = ubr."role_id"
  INNER JOIN "users" AS u
    ON u."id" = ubr."user_id"
  WHERE r."name" = 'Owner'
    AND u."deleted_at" IS NULL
  ORDER BY u."organization_id", u."created_at" ASC, u."id" ASC
) AS legacy
WHERE org."id" = legacy."organization_id"
  AND org."owner_user_id" IS NULL;

CREATE INDEX "organizations_owner_user_id_idx"
ON "organizations"("owner_user_id");

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
