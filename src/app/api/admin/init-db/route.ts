import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/pg-pool";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create User table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public."user" (
        "id" SERIAL PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "password" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
        "username" TEXT,
        "name" TEXT,
        "phone" TEXT,
        "address" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Create Professional table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public."professional" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "userId" INTEGER UNIQUE REFERENCES public."user"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Create Booking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public."booking" (
        "id" SERIAL PRIMARY KEY,
        "service" TEXT NOT NULL,
        "bookingDate" TIMESTAMPTZ NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
        "customerId" INTEGER NOT NULL REFERENCES public."user"("id") ON DELETE CASCADE,
        "professionalId" INTEGER NOT NULL REFERENCES public."professional"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Create Partial Unique Index for Concurrency Protection
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_booking_slot"
      ON public."booking" ("professionalId", "bookingDate")
      WHERE "status" != 'CANCELLED';
    `);

    // 5. Seed Users
    const defaultPasswordHash = hashPassword("password123");

    // Upsert Customers
    const ananyaRes = await client.query(`
      INSERT INTO public."user" (email, password, role, username, name, phone, address, "createdAt", "updatedAt")
      VALUES ($1, $2, 'CUSTOMER', 'ananya', 'Ananya Sharma', '9876543210', '28, 2nd Cross, Indiranagar, Bengaluru', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $2, name = 'Ananya Sharma', address = '28, 2nd Cross, Indiranagar, Bengaluru'
      RETURNING id;
    `, ["ananya@gmail.com", defaultPasswordHash]);
    const ananyaId = ananyaRes.rows[0].id;

    const aryaRes = await client.query(`
      INSERT INTO public."user" (email, password, role, username, name, phone, address, "createdAt", "updatedAt")
      VALUES ($1, $2, 'CUSTOMER', 'arya', 'Arya Tiwari', '9876543220', '14, 5th Main, Koramangala, Bengaluru', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $2, name = 'Arya Tiwari', address = '14, 5th Main, Koramangala, Bengaluru'
      RETURNING id;
    `, ["arya@gmail.com", defaultPasswordHash]);
    const aryaId = aryaRes.rows[0].id;

    // Upsert Professional Users & linked Professional rows
    const priyaUserRes = await client.query(`
      INSERT INTO public."user" (email, password, role, username, name, phone, "createdAt", "updatedAt")
      VALUES ($1, $2, 'PROFESSIONAL', 'priya', 'Priya S.', '9876543212', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $2, name = 'Priya S.'
      RETURNING id;
    `, ["priya@gmail.com", defaultPasswordHash]);
    const priyaUserId = priyaUserRes.rows[0].id;

    const priyaProRes = await client.query(`
      INSERT INTO public."professional" (name, phone, "userId", "createdAt", "updatedAt")
      VALUES ('Priya S.', '9876543212', $1, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET name = 'Priya S.', phone = '9876543212'
      RETURNING id;
    `, [priyaUserId]);
    const priyaProId = priyaProRes.rows[0].id;

    const rahulUserRes = await client.query(`
      INSERT INTO public."user" (email, password, role, username, name, phone, "createdAt", "updatedAt")
      VALUES ($1, $2, 'PROFESSIONAL', 'rahul', 'Rahul K.', '9876543211', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $2, name = 'Rahul K.'
      RETURNING id;
    `, ["rahul@gmail.com", defaultPasswordHash]);
    const rahulUserId = rahulUserRes.rows[0].id;

    const rahulProRes = await client.query(`
      INSERT INTO public."professional" (name, phone, "userId", "createdAt", "updatedAt")
      VALUES ('Rahul K.', '9876543211', $1, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET name = 'Rahul K.', phone = '9876543211'
      RETURNING id;
    `, [rahulUserId]);
    const rahulProId = rahulProRes.rows[0].id;

    const amitUserRes = await client.query(`
      INSERT INTO public."user" (email, password, role, username, name, phone, "createdAt", "updatedAt")
      VALUES ($1, $2, 'PROFESSIONAL', 'amit', 'Amit V.', '9876543213', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = $2, name = 'Amit V.'
      RETURNING id;
    `, ["amit@gmail.com", defaultPasswordHash]);
    const amitUserId = amitUserRes.rows[0].id;

    await client.query(`
      INSERT INTO public."professional" (name, phone, "userId", "createdAt", "updatedAt")
      VALUES ('Amit V.', '9876543213', $1, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET name = 'Amit V.', phone = '9876543213';
    `, [amitUserId]);

    // Clear old sample bookings and re-insert standard test fixtures
    await client.query(`DELETE FROM public."booking" WHERE "customerId" IN ($1, $2);`, [ananyaId, aryaId]);

    // 1. COMPLETED: Full home deep cleaning
    await client.query(`
      INSERT INTO public."booking" (service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt")
      VALUES ('Full home deep cleaning', '2026-08-12T04:30:00.000Z', 'COMPLETED', $1, $2, NOW(), NOW());
    `, [ananyaId, priyaProId]);

    // 2. COMPLETED: Bathroom cleaning
    await client.query(`
      INSERT INTO public."booking" (service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt")
      VALUES ('Bathroom cleaning', '2026-07-04T08:30:00.000Z', 'COMPLETED', $1, $2, NOW(), NOW());
    `, [ananyaId, priyaProId]);

    // 3. CONFIRMED: AC service & repair with Rahul
    await client.query(`
      INSERT INTO public."booking" (service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt")
      VALUES ('AC service & repair', '2026-08-27T05:00:00.000Z', 'CONFIRMED', $1, $2, NOW(), NOW());
    `, [ananyaId, rahulProId]);

    // 4. CONFIRMED: Kitchen cleaning for Priya on 26 Aug (02:00 PM IST / 08:30 UTC)
    await client.query(`
      INSERT INTO public."booking" (service, "bookingDate", status, "customerId", "professionalId", "createdAt", "updatedAt")
      VALUES ('Kitchen cleaning', '2026-08-26T08:30:00.000Z', 'CONFIRMED', $1, $2, NOW(), NOW());
    `, [aryaId, priyaProId]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Database tables created and seeded successfully!",
      accounts: {
        customers: ["ananya@gmail.com", "arya@gmail.com"],
        professionals: ["priya@gmail.com", "rahul@gmail.com", "amit@gmail.com"],
        password: "password123",
      },
    });
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    console.error("Database initialization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
