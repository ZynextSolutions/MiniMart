import { NextResponse } from "next/server";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import { enforceApiRateLimit } from "@/lib/rate-limit";
import { apiErrorResponse } from "@/lib/auth/api-error-response";

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "auth-organizations", 30);

    const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const users = await getPrismaBase().user.findMany({
    where: { email, isActive: true, deletedAt: null },
    select: {
      organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  const organizations = users
    .filter((u) => u.organization.status !== "CANCELLED")
    .map((u) => u.organization);

  return NextResponse.json({ organizations, requiresSelection: organizations.length > 1 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
