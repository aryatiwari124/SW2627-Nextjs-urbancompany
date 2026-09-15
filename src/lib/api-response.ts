import { NextResponse } from "next/server";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_EXISTS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SLOT_CONFLICT"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
  field?: string;
}

/**
 * 400 Bad Request - Malformed or invalid input
 */
export function badRequest(error: string, field?: string, code: ErrorCode = "VALIDATION_ERROR") {
  const body: ApiErrorBody = { error, code };
  if (field) body.field = field;
  return NextResponse.json(body, { status: 400 });
}

/**
 * 401 Unauthorized - Missing, invalid, or expired session
 */
export function unauthorized(
  error = "Authentication required. Please log in.",
  code: ErrorCode = "UNAUTHORIZED"
) {
  return NextResponse.json({ error, code }, { status: 401 });
}

/**
 * 403 Forbidden - Authenticated, but not authorized for this action/resource
 */
export function forbidden(
  error = "You do not have permission to access this resource.",
  code: ErrorCode = "FORBIDDEN"
) {
  return NextResponse.json({ error, code }, { status: 403 });
}

/**
 * 404 Not Found - Target resource does not exist
 */
export function notFound(
  error = "Resource not found.",
  code: ErrorCode = "NOT_FOUND"
) {
  return NextResponse.json({ error, code }, { status: 404 });
}

/**
 * 409 Conflict - Slot already booked or state collision
 */
export function slotConflict(
  error = "Professional is not available for the requested time slot.",
  code: ErrorCode = "SLOT_CONFLICT"
) {
  return NextResponse.json({ error, code }, { status: 409 });
}

/**
 * 500 Internal Server Error - Unexpected failure.
 * Always logs the real error internally, never leaks stack traces or SQL details to client.
 */
export function internalError(
  internalErr: unknown,
  clientMessage = "An unexpected error occurred. Please try again later."
) {
  console.error("[SERVER ERROR]", internalErr);
  return NextResponse.json(
    {
      error: clientMessage,
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}
