import { describe, it, expect } from "vitest";
import {
  isValidCalendarDate,
  parsePositiveIntId,
  validateSignupInput,
  validateLoginInput,
  validateRebookInput,
} from "@/lib/validation";

describe("Validation & Security Library", () => {
  describe("isValidCalendarDate", () => {
    it("accepts valid calendar dates in YYYY-MM-DD format", () => {
      expect(isValidCalendarDate("2026-08-26")).toBe(true);
      expect(isValidCalendarDate("2028-02-29")).toBe(true); // leap year
      expect(isValidCalendarDate("2026-12-31")).toBe(true);
    });

    it("rejects non-existent rollover calendar dates", () => {
      expect(isValidCalendarDate("2026-02-31")).toBe(false);
      expect(isValidCalendarDate("2026-04-31")).toBe(false); // April has 30 days
      expect(isValidCalendarDate("2027-02-29")).toBe(false); // Non-leap year
    });

    it("rejects invalid formats and types", () => {
      expect(isValidCalendarDate("26-08-2026")).toBe(false);
      expect(isValidCalendarDate("2026/08/26")).toBe(false);
      expect(isValidCalendarDate("invalid")).toBe(false);
      expect(isValidCalendarDate(null)).toBe(false);
      expect(isValidCalendarDate(12345)).toBe(false);
    });
  });

  describe("parsePositiveIntId", () => {
    it("parses valid integer IDs", () => {
      expect(parsePositiveIntId(1)).toBe(1);
      expect(parsePositiveIntId("42")).toBe(42);
      expect(parsePositiveIntId("1000")).toBe(1000);
    });

    it("rejects zero, negatives, decimals, and SQL injection strings", () => {
      expect(parsePositiveIntId(0)).toBeNull();
      expect(parsePositiveIntId(-5)).toBeNull();
      expect(parsePositiveIntId(3.14)).toBeNull();
      expect(parsePositiveIntId("1 OR 1=1")).toBeNull();
      expect(parsePositiveIntId("1; DROP TABLE users;")).toBeNull();
      expect(parsePositiveIntId("abc")).toBeNull();
      expect(parsePositiveIntId(undefined)).toBeNull();
    });
  });

  describe("validateSignupInput", () => {
    it("validates a valid customer signup", () => {
      const res = validateSignupInput({
        role: "CUSTOMER",
        name: "Ananya Sharma",
        email: "ananya@example.com",
        password: "Password123",
        address: "28, Indiranagar, Bengaluru",
      });
      expect(res.success).toBe(true);
      expect(res.data?.email).toBe("ananya@example.com");
      expect(res.data?.role).toBe("CUSTOMER");
    });

    it("validates a valid professional signup with phone", () => {
      const res = validateSignupInput({
        role: "PROFESSIONAL",
        name: "Priya S.",
        email: "priya@example.com",
        password: "Password123",
        phone: "9876543210",
      });
      expect(res.success).toBe(true);
      expect(res.data?.role).toBe("PROFESSIONAL");
      expect(res.data?.phone).toBe("9876543210");
    });

    it("rejects invalid emails", () => {
      const res = validateSignupInput({
        role: "CUSTOMER",
        name: "Test",
        email: "not-an-email",
        password: "Password123",
        address: "Some address",
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("email");
    });

    it("rejects weak passwords (<8 chars or missing digits)", () => {
      const short = validateSignupInput({
        role: "CUSTOMER",
        name: "Test",
        email: "test@example.com",
        password: "Pass1",
        address: "Some address",
      });
      expect(short.success).toBe(false);
      expect(short.field).toBe("password");

      const noDigits = validateSignupInput({
        role: "CUSTOMER",
        name: "Test",
        email: "test@example.com",
        password: "PasswordOnly",
        address: "Some address",
      });
      expect(noDigits.success).toBe(false);
      expect(noDigits.field).toBe("password");
    });

    it("requires phone for professional role", () => {
      const res = validateSignupInput({
        role: "PROFESSIONAL",
        name: "Pro Without Phone",
        email: "pro@example.com",
        password: "Password123",
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("phone");
    });

    it("requires address for customer role", () => {
      const res = validateSignupInput({
        role: "CUSTOMER",
        name: "Cust Without Address",
        email: "cust@example.com",
        password: "Password123",
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("address");
    });

    it("rejects unknown role", () => {
      const res = validateSignupInput({
        role: "ADMIN",
        name: "Admin User",
        email: "admin@example.com",
        password: "Password123",
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("role");
    });
  });

  describe("validateLoginInput", () => {
    it("accepts valid credentials", () => {
      const res = validateLoginInput({
        email: "user@example.com",
        password: "password123",
      });
      expect(res.success).toBe(true);
      expect(res.data?.email).toBe("user@example.com");
    });

    it("returns generic error without leaking field for invalid inputs", () => {
      const res = validateLoginInput({
        email: "invalid-email",
        password: "",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid email or password");
    });
  });

  describe("validateRebookInput", () => {
    it("accepts a valid rebook date and slot", () => {
      const res = validateRebookInput({
        date: "2026-08-26",
        time: "02:00 PM",
      });
      expect(res.success).toBe(true);
      expect(res.data?.time).toBe("02:00 PM");
    });

    it("rejects unknown / malicious slot time strings", () => {
      const res = validateRebookInput({
        date: "2026-08-26",
        time: "10:15 AM", // Not in standard slots whitelist
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("time");
    });

    it("rejects invalid date strings", () => {
      const res = validateRebookInput({
        date: "2026-02-31",
        time: "02:00 PM",
      });
      expect(res.success).toBe(false);
      expect(res.field).toBe("date");
    });
  });
});
