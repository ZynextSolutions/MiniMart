import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { resolveAuthorizedBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(request: Request) {
  const session = await requireApiSession(PERMISSIONS.REPORTS.SALES);
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const branchFilter = resolveAuthorizedBranchFilter(
    session.user.branchIds,
    searchParams.get("branchId") ?? session.user.branchId,
  );

  const where = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    branchId: branchFilter,
  };

  const [data, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { saleDate: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        saleType: true,
        saleDate: true,
        status: true,
        grandTotal: true,
        amountPaid: true,
        customerId: true,
      },
    }),
    prisma.sale.count({ where }),
  ]);

  return NextResponse.json({
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
