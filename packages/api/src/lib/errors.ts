import { ERROR_CODES, type ErrorCode } from "@agentsmith/shared";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.CONFLICT, message, 409);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(ERROR_CODES.PAYLOAD_TOO_LARGE, "Payload exceeds maximum size", 413);
  }
}
