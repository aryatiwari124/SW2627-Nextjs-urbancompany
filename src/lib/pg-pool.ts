import 'dotenv/config';
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const isCloudDb =
      connectionString?.includes("sslmode=require") ||
      connectionString?.includes("neon.tech") ||
      connectionString?.includes("supabase.co") ||
      connectionString?.includes("railway.app") ||
      connectionString?.includes("render.com") ||
      connectionString?.includes("amazonaws.com");

    pool = new Pool({
      connectionString,
      ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
