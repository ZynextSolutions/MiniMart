import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getUserBranches } from "@/lib/permissions/authorization";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "branches", 60);
    const session = await requireApiSession({ skipSubscriptionCheck: true });
    const branches = await getUserBranches(session.user.id);
    return NextResponse.json(branches);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
