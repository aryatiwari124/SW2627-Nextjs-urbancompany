import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as rebookHandler } from "@/app/api/bookings/[bookingId]/rebook/route";
import { signSessionToken } from "@/lib/auth";
import { db } from "../../prisma/db";
import * as pgPoolModule from "@/lib/pg-pool";

describe("POST /api/bookings/[bookingId]/rebook", () => {
  const customerToken = signSessionToken({
    userId: 10,
    email: "ananya@gmail.com",
    role: "CUSTOMER",
  });

  const otherCustomerToken = signSessionToken({
    userId: 99,
    email: "other@gmail.com",
    role: "CUSTOMER",
  });

  const professionalToken = signSessionToken({
    userId: 20,
    email: "priya@gmail.com",
    role: "PROFESSIONAL",
  });

  const mockCompletedBooking = {
    id: 10,
    service: "AC Deep Clean",
    bookingDate: new Date("2026-08-20T08:30:00.000Z"),
    status: "COMPLETED",
    customerId: 10,
    professionalId: 5,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully creates a new booking carrying over service, professional, customer without modifying the old booking", async () => {
    // Mock old booking query
    vi.spyOn(db.orm.public.Booking, "first").mockResolvedValue(mockCompletedBooking as any);

    // Mock pgPool transaction
    const mockClient = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query === "BEGIN" || query === "COMMIT" || query.includes("pg_advisory_xact_lock")) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (query.includes("OVERLAPS")) {
          return Promise.resolve({ rowCount: 0, rows: [] }); // No conflicts
        }
        if (query.includes("INSERT INTO")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: 101,
                service: mockCompletedBooking.service,
                bookingDate: "2026-08-26T08:30:00.000Z",
                status: "CONFIRMED",
                customerId: mockCompletedBooking.customerId,
                professionalId: mockCompletedBooking.professionalId,
              },
            ],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(pgPoolModule, "getPgPool").mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any);

    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        date: "2026-08-26",
        time: "02:00 PM",
      }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.booking.id).toBe(101);
    expect(data.booking.service).toBe("AC Deep Clean");
    expect(data.booking.status).toBe("CONFIRMED");
    expect(data.booking.customerId).toBe(10);
    expect(data.booking.professionalId).toBe(5);

    // Verify old booking was not modified
    expect(mockCompletedBooking.status).toBe("COMPLETED");
  });

  it("returns 401 when no session is provided", async () => {
    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-08-26", time: "02:00 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when a professional tries to rebook", async () => {
    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${professionalToken}`,
      },
      body: JSON.stringify({ date: "2026-08-26", time: "02:00 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("FORBIDDEN");
  });

  it("returns 403 when customer tries to rebook someone else's booking", async () => {
    vi.spyOn(db.orm.public.Booking, "first").mockResolvedValue(mockCompletedBooking as any);

    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherCustomerToken}`,
      },
      body: JSON.stringify({ date: "2026-08-26", time: "02:00 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("only re-book your own bookings");
  });

  it("returns 400 when trying to rebook a booking that is not COMPLETED (e.g. CANCELLED or CONFIRMED)", async () => {
    vi.spyOn(db.orm.public.Booking, "first").mockResolvedValue({
      ...mockCompletedBooking,
      status: "CONFIRMED",
    } as any);

    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ date: "2026-08-26", time: "02:00 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Only completed bookings can be re-booked");
  });

  it("returns 409 when the professional already has a booking in that slot", async () => {
    vi.spyOn(db.orm.public.Booking, "first").mockResolvedValue(mockCompletedBooking as any);

    const mockClient = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query === "BEGIN" || query.includes("pg_advisory_xact_lock")) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (query.includes("OVERLAPS")) {
          return Promise.resolve({ rowCount: 1, rows: [{ id: 50 }] }); // Conflict detected!
        }
        if (query === "ROLLBACK") {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(pgPoolModule, "getPgPool").mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any);

    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ date: "2026-08-26", time: "02:00 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("SLOT_CONFLICT");
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 400 when invalid slot format or date is provided", async () => {
    const req = new Request("http://localhost:3000/api/bookings/10/rebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ date: "2026-02-31", time: "03:15 PM" }),
    });

    const res = await rebookHandler(req, {
      params: Promise.resolve({ bookingId: "10" }),
    });

    expect(res.status).toBe(400);
  });
});
