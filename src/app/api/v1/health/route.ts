import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/lib/logger";
import { enforceApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  await enforceApiRateLimit(request, "health", 60);

  const detailed = process.env.HEALTH_DETAILED === "true" || process.env.NODE_ENV !== "production";

  if (!detailed) {
    return NextResponse.json({ status: "ok" });
  }

  let dbStatus: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = "error";
    logger.error("Health check database ping failed", error);
  }

  const body = {
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
  };

  return NextResponse.json(body, {
    status: dbStatus === "ok" ? 200 : 503,
  });
}
