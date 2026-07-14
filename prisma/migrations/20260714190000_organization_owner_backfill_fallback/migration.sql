-- Prefer earliest Owner-role user when an org still has no owner.
-- Intentionally does NOT fall back to "earliest active user" — that can grant
-- full owner bypass to an unintended account. Null owners must be set manually.
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
