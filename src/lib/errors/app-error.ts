export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : "Forbidden",
      "FORBIDDEN",
      403,
    );
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 422, details);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, "RATE_LIMIT", 429);
    this.name = "RateLimitError";
  }
}

export class InsufficientStockError extends AppError {
  constructor(variantId: string, available: string, requested: string) {
    super(
      `Insufficient stock for variant ${variantId}: available ${available}, requested ${requested}`,
      "INSUFFICIENT_STOCK",
      409,
      { variantId, available, requested },
    );
    this.name = "InsufficientStockError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (process.env.NODE_ENV === "production") {
    return "An unexpected error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}
