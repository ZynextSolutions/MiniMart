import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(request: Request) {
  const session = await requireApiSession(PERMISSIONS.CUSTOMERS.VIEW);
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const search = searchParams.get("search") ?? "";

  const where = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        loyaltyPoints: true,
        creditLimit: true,
        isActive: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
