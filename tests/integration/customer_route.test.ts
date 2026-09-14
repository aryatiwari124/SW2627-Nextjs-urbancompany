import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as customerHandler } from "@/app/api/customer/route";
import { signSessionToken } from "@/lib/auth";
import { db } from "../../prisma/db";

describe("GET /api/customer", () => {
  const customerToken = signSessionToken({
    userId: 1,
    email: "ananya@gmail.com",
    role: "CUSTOMER",
  });

  const professionalToken = signSessionToken({
    userId: 2,
    email: "priya@gmail.com",
    role: "PROFESSIONAL",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session is present in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const req = new Request("http://localhost:3000/api/customer");
    const res = await customerHandler(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");

    vi.unstubAllEnvs();
  });

  it("returns 403 when a user with PROFESSIONAL role calls customer route", async () => {
    const req = new Request("http://localhost:3000/api/customer", {
      headers: { Authorization: `Bearer ${professionalToken}` },
    });
    const res = await customerHandler(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("FORBIDDEN");
  });

  it("returns 403 when querying for a different customer ID than authenticated session", async () => {
    const req = new Request("http://localhost:3000/api/customer?id=99", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res = await customerHandler(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("cannot access another customer's data");
  });

  it("returns customer profile and past bookings for authenticated customer", async () => {
    vi.spyOn(db.orm.public.User, "first").mockResolvedValue({
      id: 1,
      name: "Ananya Sharma",
      email: "ananya@gmail.com",
      phone: "9876543210",
      address: "28, Indiranagar, Bengaluru",
    } as any);

    vi.spyOn(db.orm.public.Booking, "include").mockReturnValue({
      where: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([
          {
            id: 10,
            service: "AC Deep Clean",
            professionalId: 5,
            professional: { name: "Priya S." },
            bookingDate: new Date("2026-08-20T08:30:00.000Z"),
            status: "COMPLETED",
          },
        ]),
      }),
    } as any);

    const req = new Request("http://localhost:3000/api/customer", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res = await customerHandler(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customer.name).toBe("Ananya Sharma");
    expect(data.customer.email).toBe("ananya@gmail.com");
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].service).toBe("AC Deep Clean");
    expect(data.bookings[0].professional).toBe("Priya S.");
  });
});
