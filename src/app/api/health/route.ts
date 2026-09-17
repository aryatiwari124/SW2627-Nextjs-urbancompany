import { NextResponse } from "next/server";
import { db } from "../../../../prisma/db";
import { getPgPool } from "@/lib/pg-pool";

export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL || "";
  let maskedUrl = "NOT_SET";
  if (rawDbUrl) {
    try {
      const parsed = new URL(rawDbUrl.replace("postgresql://", "http://"));
      maskedUrl = `postgresql://${parsed.username}:****@${parsed.host}${parsed.pathname}`;
    } catch {
      maskedUrl = "SET_BUT_INVALID_URL_FORMAT";
    }
  }

  const authSecretSet = !!process.env.AUTH_SECRET;

  let dbConnection = "FAILED";
  let dbError: string | null = null;
  let userCount = 0;
  let proCount = 0;
  let bookingCount = 0;

  try {
    const users = await db.orm.public.User.all();
    userCount = users.length;
    const pros = await db.orm.public.Professional.all();
    proCount = pros.length;
    const bookings = await db.orm.public.Booking.all();
    bookingCount = bookings.length;
    dbConnection = "SUCCESS";
  } catch (err: unknown) {
    dbError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  let pgPoolStatus = "FAILED";
  let pgPoolError: string | null = null;
  try {
    const pool = getPgPool();
    const res = await pool.query("SELECT NOW() as server_time");
    if (res.rows.length > 0) {
      pgPoolStatus = "SUCCESS";
    }
  } catch (err: unknown) {
    pgPoolError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return NextResponse.json({
    status: dbConnection === "SUCCESS" && pgPoolStatus === "SUCCESS" ? "HEALTHY" : "UNHEALTHY",
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: maskedUrl,
      AUTH_SECRET_SET: authSecretSet,
    },
    database: {
      prisma: {
        status: dbConnection,
        error: dbError,
        counts: {
          users: userCount,
          professionals: proCount,
          bookings: bookingCount,
        },
      },
      pgPool: {
        status: pgPoolStatus,
        error: pgPoolError,
      },
    },
  });
}
