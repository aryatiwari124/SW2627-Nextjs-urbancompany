import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as calendarHandler } from "@/app/api/professionals/[id]/calendar/route";
import { signSessionToken } from "@/lib/auth";
import { db } from "../../prisma/db";

describe("GET /api/professionals/[id]/calendar", () => {
  const customerToken = signSessionToken({
    userId: 1,
    email: "customer@example.com",
    role: "CUSTOMER",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost:3000/api/professionals/1/calendar?date=2026-08-26");
    const res = await calendarHandler(req, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid professional ID format", async () => {
    const req = new Request("http://localhost:3000/api/professionals/abc/calendar?date=2026-08-26", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res = await calendarHandler(req, {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field).toBe("id");
  });

  it("returns 400 for missing or invalid date query param", async () => {
    const reqNoDate = new Request("http://localhost:3000/api/professionals/1/calendar", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const resNoDate = await calendarHandler(reqNoDate, {
      params: Promise.resolve({ id: "1" }),
    });
    expect(resNoDate.status).toBe(400);

    const reqBadDate = new Request("http://localhost:3000/api/professionals/1/calendar?date=2026-02-31", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const resBadDate = await calendarHandler(reqBadDate, {
      params: Promise.resolve({ id: "1" }),
    });
    expect(resBadDate.status).toBe(400);
  });

  it("returns 404 if professional does not exist", async () => {
    vi.spyOn(db.orm.public.Professional, "first").mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/professionals/999/calendar?date=2026-08-26", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res = await calendarHandler(req, {
      params: Promise.resolve({ id: "999" }),
    });

    expect(res.status).toBe(404);
  });

  it("correctly classifies booked vs available slots for existing professional", async () => {
    vi.spyOn(db.orm.public.Professional, "first").mockResolvedValue({
      id: 2,
      name: "Priya S.",
      phone: "9876543210",
      userId: 3,
    } as any);

    // Mock active booking in 02:00 PM slot (08:30:00 UTC)
    vi.spyOn(db.orm.public.Booking, "where").mockReturnValue({
      all: vi.fn().mockResolvedValue([
        {
          id: 55,
          service: "Home Cleaning",
          bookingDate: new Date("2026-08-26T08:30:00.000Z"),
          status: "CONFIRMED",
          professionalId: 2,
          customerId: 1,
        },
      ]),
    } as any);

    const req = new Request("http://localhost:3000/api/professionals/2/calendar?date=2026-08-26", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const res = await calendarHandler(req, {
      params: Promise.resolve({ id: "2" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.professional.name).toBe("Priya S.");
    expect(data.date).toBe("2026-08-26");
    expect(data.slots).toHaveLength(5);
    expect(data.availableSlots).toHaveLength(4);
    expect(data.bookedSlots).toHaveLength(1);

    const bookedSlot = data.bookedSlots[0];
    expect(bookedSlot.time).toBe("02:00 PM");
    expect(bookedSlot.status).toBe("BOOKED");
    expect(bookedSlot.booking.id).toBe(55);
  });
});
