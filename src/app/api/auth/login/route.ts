import { NextResponse } from "next/server";
import { db } from "../../../../../prisma/db";
import { verifyPassword, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { validateLoginInput } from "@/lib/validation";
import { badRequest, unauthorized, internalError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON in request body");
    }

    if (!body || typeof body !== "object") {
      return badRequest("Request body must be an object with email and password");
    }

    const { email, password } = body as Record<string, unknown>;
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return badRequest("Email and password are required");
    }

    const validation = validateLoginInput(body);
    if (!validation.success || !validation.data) {
      // Return 401 with generic message to avoid leaking user existence
      return unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    const user = await db.orm.public.User.first({ email: validation.data.email });
    if (!user) {
      return unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    const isValid = verifyPassword(validation.data.password, user.password);
    if (!isValid) {
      return unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    let professionalId: number | null = null;
    if (user.role === "PROFESSIONAL") {
      const pro = await db.orm.public.Professional.first({ userId: user.id });
      professionalId = pro?.id || null;
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      professionalId,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      message: "Logged in successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        professionalId,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600, // 7 days
    });

    return response;
  } catch (error) {
    return internalError(error, "Failed to log in. Please try again.");
  }
}
