/**
 * Input validation and sanitization library for Urban Company API routes.
 * Provides schema validation, type guards, and error formatting.
 */

export const STANDARD_SLOTS = [
  "09:00 AM",
  "11:30 AM",
  "02:00 PM",
  "04:30 PM",
  "07:00 PM",
] as const;

export type StandardSlot = (typeof STANDARD_SLOTS)[number];

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PHONE_REGEX = /^\+?[0-9\s-]{10,15}$/;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  field?: string;
}

/**
 * Validates whether a string is a real calendar date in YYYY-MM-DD format.
 * Prevents rollover (e.g. 2026-02-31).
 */
export function isValidCalendarDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates a positive integer ID (e.g. database serial primary key).
 */
export function parsePositiveIntId(val: unknown): number | null {
  if (typeof val === "number") {
    return Number.isInteger(val) && val > 0 && val <= 2147483647 ? val : null;
  }
  if (typeof val === "string" && /^[1-9]\d{0,9}$/.test(val.trim())) {
    const parsed = parseInt(val.trim(), 10);
    return parsed > 0 && parsed <= 2147483647 ? parsed : null;
  }
  return null;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "PROFESSIONAL";
  phone?: string | null;
  address?: string | null;
}

export function validateSignupInput(body: unknown): ValidationResult<SignupInput> {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body must be a valid JSON object" };
  }

  const data = body as Record<string, unknown>;

  // 1. Role validation
  if (!data.role || typeof data.role !== "string") {
    return { success: false, field: "role", error: "Role is required and must be a string" };
  }
  const role = data.role.toUpperCase();
  if (role !== "CUSTOMER" && role !== "PROFESSIONAL") {
    return {
      success: false,
      field: "role",
      error: "Role must be either 'CUSTOMER' or 'PROFESSIONAL'",
    };
  }

  // 2. Name validation
  if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    return {
      success: false,
      field: "name",
      error: "Full name is required (at least 2 characters)",
    };
  }
  if (data.name.trim().length > 100) {
    return {
      success: false,
      field: "name",
      error: "Full name must not exceed 100 characters",
    };
  }

  // 3. Email validation
  if (!data.email || typeof data.email !== "string") {
    return { success: false, field: "email", error: "Email is required" };
  }
  const email = data.email.trim().toLowerCase();
  if (email.length > 255 || !EMAIL_REGEX.test(email)) {
    return { success: false, field: "email", error: "Please enter a valid email address" };
  }

  // 4. Password validation (min 8 chars, max 128 chars, requires letters and numbers)
  if (!data.password || typeof data.password !== "string") {
    return { success: false, field: "password", error: "Password is required" };
  }
  if (data.password.length < 8) {
    return {
      success: false,
      field: "password",
      error: "Password must be at least 8 characters long",
    };
  }
  if (data.password.length > 128) {
    return {
      success: false,
      field: "password",
      error: "Password must not exceed 128 characters",
    };
  }
  if (!/[a-zA-Z]/.test(data.password) || !/[0-9]/.test(data.password)) {
    return {
      success: false,
      field: "password",
      error: "Password must contain both letters and numbers",
    };
  }

  // 5. Phone validation
  let phone: string | null = null;
  if (data.phone !== undefined && data.phone !== null && data.phone !== "") {
    if (typeof data.phone !== "string" || !PHONE_REGEX.test(data.phone.trim())) {
      return {
        success: false,
        field: "phone",
        error: "Phone number must be a valid 10-15 digit number",
      };
    }
    phone = data.phone.trim();
  }

  // For PROFESSIONAL, phone is strictly required
  if (role === "PROFESSIONAL" && !phone) {
    return {
      success: false,
      field: "phone",
      error: "Phone number is required for professional registration",
    };
  }

  // 6. Address validation
  let address: string | null = null;
  if (data.address !== undefined && data.address !== null && data.address !== "") {
    if (typeof data.address !== "string" || data.address.trim().length < 5) {
      return {
        success: false,
        field: "address",
        error: "Address must be at least 5 characters",
      };
    }
    if (data.address.trim().length > 300) {
      return {
        success: false,
        field: "address",
        error: "Address must not exceed 300 characters",
      };
    }
    address = data.address.trim();
  }

  // For CUSTOMER, address is required
  if (role === "CUSTOMER" && !address) {
    return {
      success: false,
      field: "address",
      error: "Service address is required for customer registration",
    };
  }

  return {
    success: true,
    data: {
      name: data.name.trim(),
      email,
      password: data.password,
      role: role as "CUSTOMER" | "PROFESSIONAL",
      phone,
      address,
    },
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export function validateLoginInput(body: unknown): ValidationResult<LoginInput> {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid email or password" };
  }

  const data = body as Record<string, unknown>;

  if (
    !data.email ||
    typeof data.email !== "string" ||
    data.email.trim().length === 0 ||
    data.email.length > 255 ||
    !EMAIL_REGEX.test(data.email.trim())
  ) {
    return { success: false, error: "Invalid email or password" };
  }

  if (
    !data.password ||
    typeof data.password !== "string" ||
    data.password.length === 0 ||
    data.password.length > 128
  ) {
    return { success: false, error: "Invalid email or password" };
  }

  return {
    success: true,
    data: {
      email: data.email.trim().toLowerCase(),
      password: data.password,
    },
  };
}

export interface RebookInput {
  date: string;
  time: StandardSlot;
}

export function validateRebookInput(body: unknown): ValidationResult<RebookInput> {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body must be a valid JSON object" };
  }

  const data = body as Record<string, unknown>;

  // Date validation
  if (!isValidCalendarDate(data.date)) {
    return {
      success: false,
      field: "date",
      error: "Date must be a valid calendar date in YYYY-MM-DD format",
    };
  }

  // Time slot validation
  if (typeof data.time !== "string") {
    return {
      success: false,
      field: "time",
      error: `Time slot is required. Valid slots: ${STANDARD_SLOTS.join(", ")}`,
    };
  }

  const normalizedTime = data.time.trim();
  const matchedSlot = STANDARD_SLOTS.find(
    (slot) => slot.toLowerCase() === normalizedTime.toLowerCase()
  );

  if (!matchedSlot) {
    return {
      success: false,
      field: "time",
      error: `Invalid time slot '${normalizedTime}'. Allowed slots are: ${STANDARD_SLOTS.join(", ")}`,
    };
  }

  return {
    success: true,
    data: {
      date: data.date,
      time: matchedSlot,
    },
  };
}
