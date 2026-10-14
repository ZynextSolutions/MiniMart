import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, executeRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/platform/tenant/tenant-prisma", () => ({
  getPrismaBase: () => ({
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  }),
}));

import { Prisma } from "@prisma/client";
import { checkPostgresRateLimit } from "@/lib/rate-limit/postgres-limiter";

describe("postgres rate limiter", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(0);
  });

  it("allows a request under the limit and clears expired buckets when a window starts", async () => {
    const resetAt = new Date("2026-10-14T09:00:00.000Z");
    queryRaw.mockResolvedValue([{ count: 1, reset_at: resetAt }]);

    const result = await checkPostgresRateLimit({
      key: "login:ip:127.0.0.1",
      limit: 30,
      windowMs: 60_000,
    });

    expect(result).toEqual({
      success: true,
      limit: 30,
      remaining: 29,
      resetAt: resetAt.getTime(),
    });

    const statement = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(statement.strings.join(" ")).toContain('ON CONFLICT ("key")');
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("blocks a request over the limit without running cleanup", async () => {
    const resetAt = new Date("2026-10-14T09:15:00.000Z");
    queryRaw.mockResolvedValue([{ count: 11, reset_at: resetAt }]);

    const result = await checkPostgresRateLimit({
      key: "login:email:admin@minimart.com",
      limit: 10,
      windowMs: 60_000,
    });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(resetAt.getTime());
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
