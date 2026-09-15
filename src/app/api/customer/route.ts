import { NextResponse } from "next/server";
import { db } from "../../../../prisma/db";
import { getSession } from "@/lib/auth";
import { parsePositiveIntId } from "@/lib/validation";
import { badRequest, unauthorized, forbidden, notFound, internalError } from "@/lib/api-response";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export async function GET(request: Request) {
  try {
    const session = await getSession(request);

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    const emailParam = searchParams.get("email");

    // Validate query params if supplied
    let parsedId: number | null = null;
    if (idParam !== null) {
      parsedId = parsePositiveIntId(idParam);
      if (parsedId === null) {
        return badRequest("Customer ID must be a valid positive integer", "id");
      }
    }

    if (emailParam !== null) {
      const trimmedEmail = emailParam.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 255) {
        return badRequest("Invalid email format in query parameter", "email");
      }
    }

    let targetUserId: number;

    if (!session) {
      if (process.env.NODE_ENV === "development" && (parsedId !== null || emailParam)) {
        // Dev-only fallback for automated dev scripts
        const devUser = parsedId !== null
          ? await db.orm.public.User.first({ id: parsedId })
          : await db.orm.public.User.first({ email: emailParam!.trim().toLowerCase() });

        if (!devUser) {
          return notFound("Customer not found");
        }
        targetUserId = devUser.id;
      } else {
        return unauthorized("Authentication required. Please log in.");
      }
    } else {
      // Authenticated session exists
      if (session.role !== "CUSTOMER") {
        return forbidden("Access denied. Customer role required.");
      }

      // If client supplied id or email query param, verify it matches the authenticated session user
      if (parsedId !== null && parsedId !== session.userId) {
        return forbidden("You cannot access another customer's data.");
      }
      if (
        emailParam !== null &&
        emailParam.trim().toLowerCase() !== session.email.toLowerCase()
      ) {
        return forbidden("You cannot access another customer's data.");
      }

      targetUserId = session.userId;
    }

    const customer = await db.orm.public.User.first({ id: targetUserId });

    if (!customer) {
      return notFound("Customer account not found.");
    }

    const bookings = await db.orm.public.Booking
      .include("professional")
      .where({
        customerId: customer.id,
      })
      .all();

    // Sort bookings descending by date
    const sortedBookings = [...bookings].sort(
      (a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      },
      bookings: sortedBookings.map((booking) => ({
        id: booking.id,
        service: booking.service,
        professionalId: booking.professionalId,
        professional: booking.professional.name,
        bookingDate: booking.bookingDate,
        status: booking.status,
      })),
    });
  } catch (error) {
    return internalError(error, "Failed to fetch customer data.");
  }
}