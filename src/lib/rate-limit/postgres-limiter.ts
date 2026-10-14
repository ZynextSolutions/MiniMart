import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import type { RateLimitOptions, RateLimitResult } from "./types";

const CLEANUP_GRACE_MS = 60 * 60 * 1000;
const CLEANUP_BATCH = 100;

type RateLimitRow = {
  count: number;
  reset_at: Date;
};

function toResult(count: number, resetAt: Date, limit: number): RateLimitResult {
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: resetAt.getTime(),
  };
}

async function deleteExpiredBuckets(now: Date): Promise<void> {
  const { getPrismaBase } = await import("@/platform/tenant/tenant-prisma");
  const cutoff = new Date(now.getTime() - CLEANUP_GRACE_MS);

  await getPrismaBase().$executeRaw(Prisma.sql`
    DELETE FROM "rate_limits"
    WHERE "key" IN (
      SELECT "key" FROM "rate_limits"
      WHERE "reset_at" < ${cutoff}
      LIMIT ${CLEANUP_BATCH}
    )
  `);
}

export async function checkPostgresRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { getPrismaBase } = await import("@/platform/tenant/tenant-prisma");
  const now = new Date();
  const windowEnd = new Date(now.getTime() + options.windowMs);

  const rows = await getPrismaBase().$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO "rate_limits" ("key", "count", "reset_at", "updated_at")
    VALUES (${options.key}, 1, ${windowEnd}, ${now})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "rate_limits"."reset_at" <= ${now} THEN 1
        ELSE "rate_limits"."count" + 1
      END,
      "reset_at" = CASE
        WHEN "rate_limits"."reset_at" <= ${now} THEN ${windowEnd}
        ELSE "rate_limits"."reset_at"
      END,
      "updated_at" = ${now}
    RETURNING "count", "reset_at"
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("Rate limit update did not return a row");
  }

  const count = Number(row.count);
  if (count === 1) {
    try {
      await deleteExpiredBuckets(now);
    } catch (error) {
      logger.warn("Rate limit cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return toResult(count, new Date(row.reset_at), options.limit);
}
