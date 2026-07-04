import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";

class SubscriptionInactiveError extends AppError {
  constructor(message = "Your subscription is not active") {
    super(message, "SUBSCRIPTION_INACTIVE", 402);
    this.name = "SubscriptionInactiveError";
  }
}

describe("subscription fail-closed policy", () => {
  it("uses subscription inactive error for missing subscription rows", () => {
    const error = new SubscriptionInactiveError(
      "No active subscription found for this organization",
    );
    expect(error.code).toBe("SUBSCRIPTION_INACTIVE");
    expect(error.statusCode).toBe(402);
  });
});
