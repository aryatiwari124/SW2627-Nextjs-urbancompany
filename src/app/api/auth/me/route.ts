import { NextRequest, NextResponse } from "next/server";
import { getSession, getCurrentUserFromDb } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", user: null },
        { status: 401 }
      );
    }

    const user = await getCurrentUserFromDb(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found", user: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
