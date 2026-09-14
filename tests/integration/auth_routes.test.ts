import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as signupHandler } from "@/app/api/auth/signup/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { hashPassword, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "../../prisma/db";

describe("Authentication Routes Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/signup", () => {
    it("creates a new customer account and returns 201 with session cookie", async () => {
      vi.spyOn(db.orm.public.User, "first").mockResolvedValue(null);
      vi.spyOn(db.orm.public.User, "create").mockResolvedValue({
        id: 15,
        name: "Test Customer",
        email: "newcust@example.com",
        role: "CUSTOMER",
        phone: "9876543210",
        address: "28, Indiranagar, Bengaluru",
      } as any);

      const req = new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "CUSTOMER",
          name: "Test Customer",
          email: "newcust@example.com",
          password: "Password123",
          address: "28, Indiranagar, Bengaluru",
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.email).toBe("newcust@example.com");
      expect(data.user.role).toBe("CUSTOMER");

      // Verify session cookie was set
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain(SESSION_COOKIE_NAME);
    });

    it("creates a new professional account with linked Professional entity", async () => {
      vi.spyOn(db.orm.public.User, "first").mockResolvedValue(null);
      vi.spyOn(db.orm.public.User, "create").mockResolvedValue({
        id: 25,
        name: "Test Pro",
        email: "newpro@example.com",
        role: "PROFESSIONAL",
        phone: "9876543210",
      } as any);

      vi.spyOn(db.orm.public.Professional, "create").mockResolvedValue({
        id: 12,
        name: "Test Pro",
        phone: "9876543210",
        userId: 25,
      } as any);

      const req = new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "PROFESSIONAL",
          name: "Test Pro",
          email: "newpro@example.com",
          password: "Password123",
          phone: "9876543210",
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.professionalId).toBe(12);
    });

    it("rejects duplicate email with 409", async () => {
      vi.spyOn(db.orm.public.User, "first").mockResolvedValue({
        id: 1,
        email: "existing@example.com",
      } as any);

      const req = new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "CUSTOMER",
          name: "Duplicate User",
          email: "existing@example.com",
          password: "Password123",
          address: "Some address",
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("authenticates valid credentials and sets session cookie", async () => {
      const passwordHash = hashPassword("password123");
      vi.spyOn(db.orm.public.User, "first").mockResolvedValue({
        id: 10,
        email: "valid@example.com",
        password: passwordHash,
        name: "Valid User",
        role: "CUSTOMER",
      } as any);

      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "valid@example.com",
          password: "password123",
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe("valid@example.com");
      expect(res.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
    });

    it("returns 401 generic error for invalid password", async () => {
      const passwordHash = hashPassword("realpassword");
      vi.spyOn(db.orm.public.User, "first").mockResolvedValue({
        id: 10,
        email: "valid@example.com",
        password: passwordHash,
        role: "CUSTOMER",
      } as any);

      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "valid@example.com",
          password: "wrongpassword",
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid email or password");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns user data for authenticated session", async () => {
      const token = signSessionToken({
        userId: 10,
        email: "me@example.com",
        role: "CUSTOMER",
      });

      vi.spyOn(db.orm.public.User, "first").mockResolvedValue({
        id: 10,
        email: "me@example.com",
        name: "Me User",
        role: "CUSTOMER",
      } as any);

      const req = new Request("http://localhost:3000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await meHandler(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe("me@example.com");
    });

    it("returns 401 when no session exists", async () => {
      const req = new Request("http://localhost:3000/api/auth/me");
      const res = await meHandler(req as any);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the session cookie", async () => {
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("Max-Age=0");
    });
  });
});
