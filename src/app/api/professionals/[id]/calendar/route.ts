import { NextResponse } from "next/server";
import { db } from "../../../../../../prisma/db";
import { computeDailySlots } from "@/lib/availability";
import { getSession } from "@/lib/auth";
import { isValidCalendarDate, parsePositiveIntId } from "@/lib/validation";
import { badRequest, unauthorized, notFound, internalError } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return unauthorized("Authentication required. Please log in.");
    }

    const { id } = await context.params;
    const professionalId = parsePositiveIntId(id);

    if (professionalId === null) {
      return badRequest("Professional ID must be a valid positive integer", "id");
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return badRequest("Date query parameter is required in YYYY-MM-DD format", "date");
    }

    if (!isValidCalendarDate(date)) {
      return badRequest("Date must be a valid calendar date in YYYY-MM-DD format", "date");
    }

    // Find professional
    const professional = await db.orm.public.Professional.first({
      id: professionalId,
    });

    if (!professional) {
      return notFound("Professional not found.");
    }

    // Get all bookings for this professional
    const bookings = await db.orm.public.Booking
      .where({
        professionalId,
      })
      .all();

    // Compute slot availability (open vs booked vs held) for the requested date
    const { allSlots, availableSlots, bookedSlots } = computeDailySlots(
      date,
      bookings
    );

    return NextResponse.json({
      professional: {
        id: professional.id,
        name: professional.name,
        phone: professional.phone,
      },
      date,
      slots: allSlots,
      availableSlots,
      bookedSlots,
    });
  } catch (error) {
    return internalError(error, "Failed to fetch professional calendar.");
  }
}