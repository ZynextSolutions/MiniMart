import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, getErrorMessage } from "../app-error";

describe("getErrorMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns AppError message in all environments", () => {
    const error = new AppError("Validation failed", "VALIDATION_ERROR", 422);
    expect(getErrorMessage(error)).toBe("Validation failed");
  });

  it("returns raw Error message in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getErrorMessage(new Error("database connection failed"))).toBe(
      "database connection failed",
    );
  });

  it("hides raw Error message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getErrorMessage(new Error("database connection failed"))).toBe(
      "An unexpected error occurred",
    );
  });
});
