import { NextResponse } from "next/server";
import { db } from "../../../../../prisma/db";
import { hashPassword, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { validateSignupInput } from "@/lib/validation";
import { badRequest, internalError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON in request body");
    }

    const validation = validateSignupInput(body);
    if (!validation.success || !validation.data) {
      return badRequest(validation.error || "Invalid registration details", validation.field);
    }

    const { email, password, name, phone, address, role } = validation.data;

    // Check if user already exists
    const existing = await db.orm.public.User.first({ email });
    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email address already exists.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 }
      );
    }

    const hashedPassword = hashPassword(password);

    // Create user
    const newUser = await db.orm.public.User.create({
      email,
      password: hashedPassword,
      name,
      phone,
      address,
      role,
    });

    let professionalId: number | null = null;
    if (role === "PROFESSIONAL") {
      const newPro = await db.orm.public.Professional.create({
        name,
        phone,
        userId: newUser.id,
      });
      professionalId = newPro.id;
    }

    const token = signSessionToken({
      userId: newUser.id,
      email: newUser.email,
      role,
      professionalId,
      name: newUser.name,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role,
          professionalId,
        },
      },
      { status: 201 }
    );

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
    return internalError(error, "Failed to create account. Please try again.");
  }
}
