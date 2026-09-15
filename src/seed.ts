import { db } from "../prisma/db";
import { hashPassword } from "./lib/auth";
import { getPgPool } from "./lib/pg-pool";

async function main() {
  // Ensure unique partial index for concurrency safety
  const pool = getPgPool();
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_booking_slot"
    ON public.booking ("professionalId", "bookingDate")
    WHERE "status" != 'CANCELLED';
  `);

  // Clear existing records
  const existingBookings = await db.orm.public.Booking.all();
  for (const b of existingBookings) {
    await db.orm.public.Booking.where({ id: b.id }).delete();
  }

  const existingPros = await db.orm.public.Professional.all();
  for (const p of existingPros) {
    await db.orm.public.Professional.where({ id: p.id }).delete();
  }

  const existingUsers = await db.orm.public.User.all();
  for (const u of existingUsers) {
    await db.orm.public.User.where({ id: u.id }).delete();
  }

  const defaultPasswordHash = hashPassword("password123");

  // Create Customers
  const ananya = await db.orm.public.User.create({
    email: "ananya@gmail.com",
    username: "ananya",
    name: "Ananya Sharma",
    phone: "9876543210",
    address: "28, 2nd Cross, Indiranagar, Bengaluru",
    role: "CUSTOMER",
    password: defaultPasswordHash,
  });

  const arya = await db.orm.public.User.create({
    email: "arya@gmail.com",
    username: "arya",
    name: "Arya Tiwari",
    phone: "9876543220",
    address: "14, 5th Main, Koramangala, Bengaluru",
    role: "CUSTOMER",
    password: defaultPasswordHash,
  });

  // Create Professional Users & Linked Professionals
  const priyaUser = await db.orm.public.User.create({
    email: "priya@gmail.com",
    username: "priya",
    name: "Priya S.",
    phone: "9876543212",
    role: "PROFESSIONAL",
    password: defaultPasswordHash,
  });

  const priya = await db.orm.public.Professional.create({
    name: "Priya S.",
    phone: "9876543212",
    userId: priyaUser.id,
  });

  const rahulUser = await db.orm.public.User.create({
    email: "rahul@gmail.com",
    username: "rahul",
    name: "Rahul K.",
    phone: "9876543211",
    role: "PROFESSIONAL",
    password: defaultPasswordHash,
  });

  const rahul = await db.orm.public.Professional.create({
    name: "Rahul K.",
    phone: "9876543211",
    userId: rahulUser.id,
  });

  const amitUser = await db.orm.public.User.create({
    email: "amit@gmail.com",
    username: "amit",
    name: "Amit V.",
    phone: "9876543213",
    role: "PROFESSIONAL",
    password: defaultPasswordHash,
  });

  const amit = await db.orm.public.Professional.create({
    name: "Amit V.",
    phone: "9876543213",
    userId: amitUser.id,
  });

  // Past Bookings for Ananya
  // 1. COMPLETED: Full home deep cleaning with Priya
  await db.orm.public.Booking.create({
    service: "Full home deep cleaning",
    bookingDate: "2026-08-12T10:00:00+05:30",
    status: "COMPLETED",
    customerId: ananya.id,
    professionalId: priya.id,
  });

  // 2. COMPLETED: Bathroom cleaning with Priya
  await db.orm.public.Booking.create({
    service: "Bathroom cleaning",
    bookingDate: "2026-07-04T14:00:00+05:30",
    status: "COMPLETED",
    customerId: ananya.id,
    professionalId: priya.id,
  });

  // 3. UPCOMING / CONFIRMED: AC service & repair with Rahul
  await db.orm.public.Booking.create({
    service: "AC service & repair",
    bookingDate: "2026-08-27T10:30:00+05:30",
    status: "CONFIRMED",
    customerId: ananya.id,
    professionalId: rahul.id,
  });

  // 4. CONFIRMED slot on Priya's calendar for 2026-08-26 at 09:00 AM (for testing conflict 409)
  await db.orm.public.Booking.create({
    service: "Kitchen cleaning",
    bookingDate: "2026-08-26T09:00:00+05:30",
    status: "CONFIRMED",
    customerId: arya.id,
    professionalId: priya.id,
  });

  // 5. COMPLETED booking for Arya with Rahul
  await db.orm.public.Booking.create({
    service: "AC service & repair",
    bookingDate: "2026-08-20T10:00:00+05:30",
    status: "COMPLETED",
    customerId: arya.id,
    professionalId: rahul.id,
  });

  console.log("Seed data created successfully!");
  console.log(`- Customer Ananya ID: ${ananya.id}, Email: ${ananya.email}`);
  console.log(`- Customer Arya ID: ${arya.id}, Email: ${arya.email}`);
  console.log(`- Professional Priya ID: ${priya.id}`);
  console.log(`- Professional Rahul ID: ${rahul.id}`);
  console.log(`- Professional Amit ID: ${amit.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.close();
  });