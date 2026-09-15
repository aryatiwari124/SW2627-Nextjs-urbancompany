export interface SlotDefinition {
  time: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export const DEFAULT_TIMEZONE_OFFSET = "+05:30"; // IST (Indian Standard Time)

export const STANDARD_DAILY_SLOTS: SlotDefinition[] = [
  { time: "09:00 AM", startHour: 9, startMinute: 0, endHour: 11, endMinute: 30 },
  { time: "11:30 AM", startHour: 11, startMinute: 30, endHour: 14, endMinute: 0 },
  { time: "02:00 PM", startHour: 14, startMinute: 0, endHour: 16, endMinute: 30 },
  { time: "04:30 PM", startHour: 16, startMinute: 30, endHour: 19, endMinute: 0 },
  { time: "07:00 PM", startHour: 19, startMinute: 0, endHour: 21, endMinute: 30 },
];

export const DEFAULT_SLOT_DURATION_MINUTES = 150; // 2.5 hours

/**
 * Checks if two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function isIntervalOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

/**
 * Parses a date (YYYY-MM-DD) and a time string into Date start and end boundaries in local service timezone (+05:30).
 * Supports "09:00 AM", "09:00", "14:30", ISO strings, etc.
 */
export function parseSlotTime(
  dateStr: string,
  timeStr: string,
  durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES,
  tzOffset: string = DEFAULT_TIMEZONE_OFFSET
): { start: Date; end: Date } {
  const trimmedTime = timeStr.trim();

  // Check if standard slot format e.g. "09:00 AM" or "02:00 PM"
  const standardSlot = STANDARD_DAILY_SLOTS.find(
    (s) => s.time.toLowerCase() === trimmedTime.toLowerCase()
  );

  let start: Date;
  let end: Date;

  if (standardSlot) {
    const startIso = `${dateStr}T${String(standardSlot.startHour).padStart(2, "0")}:${String(standardSlot.startMinute).padStart(2, "0")}:00${tzOffset}`;
    const endIso = `${dateStr}T${String(standardSlot.endHour).padStart(2, "0")}:${String(standardSlot.endMinute).padStart(2, "0")}:00${tzOffset}`;
    start = new Date(startIso);
    end = new Date(endIso);
  } else if (/^\d{1,2}:\d{2}(\s*(AM|PM))?$/i.test(trimmedTime)) {
    let [timePart, meridiem] = trimmedTime.split(/\s+/);
    let [hoursStr, minutesStr] = timePart.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (meridiem) {
      const upper = meridiem.toUpperCase();
      if (upper === "PM" && hours < 12) hours += 12;
      if (upper === "AM" && hours === 12) hours = 0;
    }

    const startIso = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00${tzOffset}`;
    start = new Date(startIso);
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  } else {
    // If it already includes timezone info (+ or Z), parse directly; otherwise append local timezone offset
    let isoString = `${dateStr}T${trimmedTime}`;
    if (!trimmedTime.includes("+") && !trimmedTime.includes("-") && !trimmedTime.endsWith("Z")) {
      isoString = `${isoString}${tzOffset}`;
    }
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) {
      start = new Date(`${dateStr}T09:00:00${tzOffset}`);
    } else {
      start = dateObj;
    }
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  return { start, end };
}

export interface BookingLike {
  id?: number;
  service?: string;
  bookingDate: string | Date;
  status: string;
}

/**
 * Checks if a requested time window overlaps with any active bookings for a professional.
 */
export function hasBookingConflict(
  bookings: BookingLike[],
  requestedStart: Date,
  requestedEnd: Date,
  durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES
): boolean {
  for (const booking of bookings) {
    const status = (booking.status || "").toUpperCase();
    // Cancelled bookings do not block slots
    if (status === "CANCELLED") continue;

    const bookingStart = new Date(booking.bookingDate);
    if (isNaN(bookingStart.getTime())) continue;

    const bookingEnd = new Date(
      bookingStart.getTime() + durationMinutes * 60 * 1000
    );

    if (isIntervalOverlapping(requestedStart, requestedEnd, bookingStart, bookingEnd)) {
      return true;
    }
  }

  return false;
}

export interface SlotStatus {
  time: string;
  start: string;
  end: string;
  status: "OPEN" | "BOOKED" | "HELD";
  booking?: {
    id?: number;
    service?: string;
    status?: string;
  };
}

/**
 * Generates slot status (available vs booked) for a professional for a given date in local timezone (+05:30).
 */
export function computeDailySlots(
  dateStr: string,
  bookings: BookingLike[],
  durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES,
  tzOffset: string = DEFAULT_TIMEZONE_OFFSET
): {
  allSlots: SlotStatus[];
  availableSlots: SlotStatus[];
  bookedSlots: SlotStatus[];
} {
  const allSlots: SlotStatus[] = [];

  for (const slotDef of STANDARD_DAILY_SLOTS) {
    const startIso = `${dateStr}T${String(slotDef.startHour).padStart(2, "0")}:${String(slotDef.startMinute).padStart(2, "0")}:00${tzOffset}`;
    const endIso = `${dateStr}T${String(slotDef.endHour).padStart(2, "0")}:${String(slotDef.endMinute).padStart(2, "0")}:00${tzOffset}`;
    const start = new Date(startIso);
    const end = new Date(endIso);

    const conflictingBooking = bookings.find((b) => {
      const status = (b.status || "").toUpperCase();
      if (status === "CANCELLED") return false;

      const bookingStart = new Date(b.bookingDate);
      if (isNaN(bookingStart.getTime())) return false;
      const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60 * 1000);

      return isIntervalOverlapping(start, end, bookingStart, bookingEnd);
    });

    if (conflictingBooking) {
      allSlots.push({
        time: slotDef.time,
        start: start.toISOString(),
        end: end.toISOString(),
        status: (conflictingBooking.status || "").toUpperCase() === "HELD" ? "HELD" : "BOOKED",
        booking: {
          id: conflictingBooking.id,
          service: conflictingBooking.service,
          status: conflictingBooking.status,
        },
      });
    } else {
      allSlots.push({
        time: slotDef.time,
        start: start.toISOString(),
        end: end.toISOString(),
        status: "OPEN",
      });
    }
  }

  const availableSlots = allSlots.filter((s) => s.status === "OPEN");
  const bookedSlots = allSlots.filter((s) => s.status === "BOOKED" || s.status === "HELD");

  return { allSlots, availableSlots, bookedSlots };
}


