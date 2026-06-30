import { NextResponse } from "next/server";
import { getErrorMessage, isAppError, RateLimitError } from "@/lib/errors/app-error";

export function apiErrorResponse(error: unknown) {
  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  if (isAppError(error)) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: getErrorMessage(error) },
    { status: 500 },
  );
}
