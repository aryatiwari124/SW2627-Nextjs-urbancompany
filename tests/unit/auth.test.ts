import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  getSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

describe("Authentication & Session Token Engine", () => {
  describe("Password Hashing & Verification", () => {
    it("hashes password with unique salts", () => {
      const hash1 = hashPassword("secret123");
      const hash2 = hashPassword("secret123");
      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(":");
      expect(hash2).toContain(":");
    });

    it("verifies correct password against hash", () => {
      const hash = hashPassword("mypassword!2026");
      expect(verifyPassword("mypassword!2026", hash)).toBe(true);
    });

    it("rejects incorrect password", () => {
      const hash = hashPassword("mypassword!2026");
      expect(verifyPassword("wrongpassword", hash)).toBe(false);
    });

    it("handles malformed hash gracefully", () => {
      expect(verifyPassword("mypassword", "malformed_hash_no_colon")).toBe(false);
      expect(verifyPassword("mypassword", "")).toBe(false);
    });
  });

  describe("Session JWT Tokens", () => {
    it("signs and verifies valid customer session token", () => {
      const token = signSessionToken({
        userId: 1,
        email: "customer@example.com",
        role: "CUSTOMER",
      });

      const payload = verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(1);
      expect(payload?.email).toBe("customer@example.com");
      expect(payload?.role).toBe("CUSTOMER");
      expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("signs and verifies professional session token with professionalId", () => {
      const token = signSessionToken({
        userId: 2,
        email: "pro@example.com",
        role: "PROFESSIONAL",
        professionalId: 10,
      });

      const payload = verifySessionToken(token);
      expect(payload?.userId).toBe(2);
      expect(payload?.role).toBe("PROFESSIONAL");
      expect(payload?.professionalId).toBe(10);
    });

    it("rejects tampered signature", () => {
      const token = signSessionToken({
        userId: 1,
        email: "victim@example.com",
        role: "CUSTOMER",
      });

      const parts = token.split(".");
      // Tamper payload to escalate role to PROFESSIONAL / change userId
      const tamperedBody = Buffer.from(
        JSON.stringify({ userId: 999, email: "hacker@example.com", role: "PROFESSIONAL", exp: 9999999999 })
      ).toString("base64url");
      const tamperedToken = `${parts[0]}.${tamperedBody}.${parts[2]}`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });

    it("rejects expired token", () => {
      // Create token with -10 seconds expiration
      const token = signSessionToken(
        { userId: 1, email: "expired@example.com", role: "CUSTOMER" },
        -10
      );
      expect(verifySessionToken(token)).toBeNull();
    });
  });

  describe("getSession extraction", () => {
    it("extracts session from Authorization Bearer header", async () => {
      const token = signSessionToken({
        userId: 5,
        email: "bearer@example.com",
        role: "CUSTOMER",
      });

      const req = new Request("http://localhost:3000/api/customer", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const session = await getSession(req);
      expect(session?.userId).toBe(5);
      expect(session?.email).toBe("bearer@example.com");
    });

    it("extracts session from Cookie header", async () => {
      const token = signSessionToken({
        userId: 6,
        email: "cookie@example.com",
        role: "CUSTOMER",
      });

      const req = new Request("http://localhost:3000/api/customer", {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${token}; other_cookie=123`,
        },
      });

      const session = await getSession(req);
      expect(session?.userId).toBe(6);
    });

    it("returns null when no auth credentials provided", async () => {
      const req = new Request("http://localhost:3000/api/customer");
      const session = await getSession(req);
      expect(session).toBeNull();
    });
  });
});
