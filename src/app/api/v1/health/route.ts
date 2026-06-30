import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
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
