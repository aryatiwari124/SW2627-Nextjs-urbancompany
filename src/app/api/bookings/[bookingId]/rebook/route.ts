import { NextResponse } from "next/server";
import { db } from "../../../../../../prisma/db";
import { parseSlotTime, hasBookingConflict } from "@/lib/availability";
import { getSession } from "@/lib/auth";
import { validateRebookInput, parsePositiveIntId } from "@/lib/validation";
import { badRequest, unauthorized, forbidden, notFound, slotConflict, internalError } from "@/lib/api-response";
import { getPgPool } from "@/lib/pg-pool";

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId: bookingIdParam } = await context.params;
    const bookingId = parsePositiveIntId(bookingIdParam);

    if (bookingId === null) {
      return badRequest("Booking ID must be a valid positive integer", "bookingId");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON in request body");
    }

    const validation = validateRebookInput(body);
    if (!validation.success || !validation.data) {
      return badRequest(validation.error || "Invalid booking slot selection", validation.field);
    }

    const { date, time } = validation.data;

    const session = await getSession(request);
    if (!session) {
      return unauthorized("Authentication required. Please log in.");
    }

    if (session.role !== "CUSTOMER") {
      return forbidden("Only customers can re-book services.");
    }

    // Find the old booking
    const oldBooking = await db.orm.public.Booking.first({
      id: bookingId,
    });

    if (!oldBooking) {
      return notFound("Booking not found.");
    }

    // Authorization check: User can only re-book their own bookings
    if (oldBooking.customerId !== session.userId) {
      return forbidden("You can only re-book your own bookings.");
    }

    // Only COMPLETED bookings can be re-booked
    const oldStatus = (oldBooking.status || "").toUpperCase();
    if (oldStatus !== "COMPLETED") {
      return badRequest("Only completed bookings can be re-booked.");
    }

    // Parse requested time interval in IST (+05:30)
    const { start: requestedStart, end: requestedEnd } = parseSlotTime(date, time);

    // Concurrency-safe atomic booking via PostgreSQL advisory transaction lock & unique constraint
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock specifically on this professional + slot to prevent concurrent double-booking races
      const lockKey = `booking_${oldBooking.professionalId}_${requestedStart.toISOString()}`;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);

      // Query any active overlapping bookings for this professional
      const conflictRes = await client.query(
        `SELECT id FROM public.booking
         WHERE "professionalId" = $1
         AND status != 'CANCELLED'
         AND ("bookingDate", "bookingDate" + interval '150 minutes') OVERLAPS ($2::timestamptz, $3::timestamptz)
         LIMIT 1`,
        [oldBooking.professionalId, requestedStart.toISOString(), requestedEnd.toISOString()]
      );

      if (conflictRes.rowCount && conflictRes.rowCount > 0) {
        await client.query("ROLLBACK");
        return slotConflict("Professional is not available for the requested time slot.");
      }

      // Insert new confirmed booking
      const insertRes = await client.query(
        `INSERT INTO public.booking (service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'CONFIRMED', $3, $4, NOW(), NOW())
         RETURNING id, service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt"`,
        [
          oldBooking.service,
          requestedStart.toISOString(),
          oldBooking.customerId,
          oldBooking.professionalId,
        ]
      );

      await client.query("COMMIT");

      const createdBooking = insertRes.rows[0];

      return NextResponse.json(
        {
          success: true,
          message: "Booking re-booked successfully",
          booking: {
            id: createdBooking.id,
            service: createdBooking.service,
            bookingDate: createdBooking.bookingDate,
            status: createdBooking.status,
            customerId: createdBooking.customerId,
            professionalId: createdBooking.professionalId,
          },
        },
        { status: 201 }
      );
    } catch (dbErr: any) {
      await client.query("ROLLBACK").catch(() => {});
      // PostgreSQL unique_violation error code
      if (dbErr.code === "23505") {
        return slotConflict("Professional is not available for the requested time slot.");
      }
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error) {
    return internalError(error, "Failed to re-book appointment.");
  }
}