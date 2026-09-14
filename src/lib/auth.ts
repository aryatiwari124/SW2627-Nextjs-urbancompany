import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "../../prisma/db";

const AUTH_SECRET = process.env.AUTH_SECRET || "urban-company-secret-key-2026-auth-session-cookie-secure-token";
export const SESSION_COOKIE_NAME = "uc_session_token";

export type Role = "CUSTOMER" | "PROFESSIONAL";

export interface SessionPayload {
  userId: number;
  email: string;
  role: Role;
  professionalId?: number | null;
  name?: string | null;
  exp: number;
}

/**
 * Hashes a plaintext password using salted scrypt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored salted scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const computed = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

/**
 * Signs a session payload into a secure HMAC-SHA256 token.
 */
export function signSessionToken(
  payload: Omit<SessionPayload, "exp">,
  expiresInSeconds = 7 * 24 * 3600 // 7 days
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = createHmac("sha256", AUTH_SECRET).update(`${header}.${body}`).digest("base64url");
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current session user from cookies (in Route Handlers / Server Components)
 * or falls back to an Authorization: Bearer token header if present.
 */
export async function getSession(request?: Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  // 1. Check Authorization header
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    // Check request Cookie header if available
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
        if (match) token = match[1];
      }
    }
  }

  // 2. Check next/headers cookies()
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Not in a context with next/headers cookies()
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Finds user details with linked professional profile if applicable.
 */
export async function getCurrentUserFromDb(userId: number) {
  const user = await db.orm.public.User.first({ id: userId });
  if (!user) return null;

  let professional = null;
  if (user.role === "PROFESSIONAL") {
    professional = await db.orm.public.Professional.first({ userId: user.id });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    role: user.role,
    professionalId: professional?.id || null,
  };
}

