import { afterEach, describe, expect, it } from "vitest";
import { AppError, getErrorMessage } from "../app-error";

describe("getErrorMessage", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns AppError message in all environments", () => {
    const error = new AppError("Validation failed", "VALIDATION_ERROR", 422);
    expect(getErrorMessage(error)).toBe("Validation failed");
  });

  it("returns raw Error message in development", () => {
    process.env.NODE_ENV = "development";
    expect(getErrorMessage(new Error("database connection failed"))).toBe(
      "database connection failed",
    );
  });

  it("hides raw Error message in production", () => {
    process.env.NODE_ENV = "production";
    expect(getErrorMessage(new Error("database connection failed"))).toBe(
      "An unexpected error occurred",
    );
  });
});
