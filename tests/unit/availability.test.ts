import { describe, it, expect } from "vitest";
import {
  isIntervalOverlapping,
  parseSlotTime,
  hasBookingConflict,
  computeDailySlots,
  STANDARD_DAILY_SLOTS,
} from "@/lib/availability";

describe("Availability Engine", () => {
  describe("isIntervalOverlapping", () => {
    it("detects exact same interval overlap", () => {
      const a = new Date("2026-08-26T09:00:00+05:30");
      const b = new Date("2026-08-26T11:30:00+05:30");
      expect(isIntervalOverlapping(a, b, a, b)).toBe(true);
    });

    it("detects partial overlap when B starts inside A", () => {
      const aStart = new Date("2026-08-26T09:00:00+05:30");
      const aEnd = new Date("2026-08-26T11:30:00+05:30");
      const bStart = new Date("2026-08-26T10:00:00+05:30");
      const bEnd = new Date("2026-08-26T12:30:00+05:30");
      expect(isIntervalOverlapping(aStart, aEnd, bStart, bEnd)).toBe(true);
    });

    it("returns false for adjacent intervals (A end == B start)", () => {
      const aStart = new Date("2026-08-26T09:00:00+05:30");
      const aEnd = new Date("2026-08-26T11:30:00+05:30");
      const bStart = new Date("2026-08-26T11:30:00+05:30");
      const bEnd = new Date("2026-08-26T14:00:00+05:30");
      expect(isIntervalOverlapping(aStart, aEnd, bStart, bEnd)).toBe(false);
    });

    it("returns false for completely disjoint intervals", () => {
      const aStart = new Date("2026-08-26T09:00:00+05:30");
      const aEnd = new Date("2026-08-26T11:30:00+05:30");
      const bStart = new Date("2026-08-26T14:00:00+05:30");
      const bEnd = new Date("2026-08-26T16:30:00+05:30");
      expect(isIntervalOverlapping(aStart, aEnd, bStart, bEnd)).toBe(false);
    });
  });

  describe("parseSlotTime", () => {
    it("parses 12-hour standard slot with IST offset", () => {
      const { start, end } = parseSlotTime("2026-08-26", "02:00 PM");
      // 2:00 PM IST is 08:30:00 UTC
      expect(start.toISOString()).toBe("2026-08-26T08:30:00.000Z");
      // End at 4:30 PM IST (2.5 hours later) -> 11:00:00 UTC
      expect(end.toISOString()).toBe("2026-08-26T11:00:00.000Z");
    });

    it("parses morning standard slot 09:00 AM IST", () => {
      const { start, end } = parseSlotTime("2026-08-26", "09:00 AM");
      // 09:00 AM IST is 03:30:00 UTC
      expect(start.toISOString()).toBe("2026-08-26T03:30:00.000Z");
      expect(end.toISOString()).toBe("2026-08-26T06:00:00.000Z");
    });

    it("handles 24h format like 14:00", () => {
      const { start, end } = parseSlotTime("2026-08-26", "14:00");
      expect(start.toISOString()).toBe("2026-08-26T08:30:00.000Z");
      expect(end.getTime() - start.getTime()).toBe(150 * 60 * 1000); // 150 minutes
    });

    it("handles month boundary and leap day dates", () => {
      const { start } = parseSlotTime("2028-02-29", "09:00 AM");
      expect(start.toISOString()).toBe("2028-02-29T03:30:00.000Z");
    });
  });

  describe("hasBookingConflict", () => {
    const existingBookings = [
      {
        id: 1,
        service: "AC Deep Clean",
        bookingDate: "2026-08-26T08:30:00.000Z", // 02:00 PM IST
        status: "CONFIRMED",
      },
      {
        id: 2,
        service: "Bathroom Cleaning",
        bookingDate: "2026-08-26T03:30:00.000Z", // 09:00 AM IST
        status: "CANCELLED", // Cancelled should NOT block
      },
    ];

    it("detects conflict for the same occupied slot", () => {
      const { start, end } = parseSlotTime("2026-08-26", "02:00 PM");
      expect(hasBookingConflict(existingBookings, start, end)).toBe(true);
    });

    it("allows booking an adjacent unoccupied slot", () => {
      const { start, end } = parseSlotTime("2026-08-26", "04:30 PM");
      expect(hasBookingConflict(existingBookings, start, end)).toBe(false);
    });

    it("allows booking a slot whose prior booking was CANCELLED", () => {
      const { start, end } = parseSlotTime("2026-08-26", "09:00 AM");
      expect(hasBookingConflict(existingBookings, start, end)).toBe(false);
    });

    it("allows booking the same time slot on a different day", () => {
      const { start, end } = parseSlotTime("2026-08-27", "02:00 PM");
      expect(hasBookingConflict(existingBookings, start, end)).toBe(false);
    });
  });

  describe("computeDailySlots", () => {
    it("returns 5 standard daily slots with accurate OPEN/BOOKED statuses", () => {
      const bookings = [
        {
          id: 10,
          service: "Sofa Cleaning",
          bookingDate: "2026-08-26T08:30:00.000Z", // 02:00 PM IST
          status: "CONFIRMED",
        },
        {
          id: 11,
          service: "Kitchen Cleaning",
          bookingDate: "2026-08-26T11:00:00.000Z", // 04:30 PM IST
          status: "HELD",
        },
      ];

      const { allSlots, availableSlots, bookedSlots } = computeDailySlots(
        "2026-08-26",
        bookings
      );

      expect(allSlots).toHaveLength(STANDARD_DAILY_SLOTS.length);
      expect(allSlots.map((s) => s.time)).toEqual([
        "09:00 AM",
        "11:30 AM",
        "02:00 PM",
        "04:30 PM",
        "07:00 PM",
      ]);

      expect(availableSlots).toHaveLength(3);
      expect(bookedSlots).toHaveLength(2);

      const slot2pm = allSlots.find((s) => s.time === "02:00 PM");
      expect(slot2pm?.status).toBe("BOOKED");
      expect(slot2pm?.booking?.id).toBe(10);
      expect(slot2pm?.booking?.service).toBe("Sofa Cleaning");

      const slot430pm = allSlots.find((s) => s.time === "04:30 PM");
      expect(slot430pm?.status).toBe("HELD");

      const slot9am = allSlots.find((s) => s.time === "09:00 AM");
      expect(slot9am?.status).toBe("OPEN");
    });
  });
});
