import { NextRequest, NextResponse } from "next/server";
import { getTopPostByPeriod } from "@/lib/dataStore";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period") as "day" | "week" | "month" | null;

  if (!period || !["day", "week", "month"].includes(period)) {
    return NextResponse.json(
      {
        message:
          "Invalid or missing period parameter. Must be one of: day, week, month.",
      },
      { status: 400 }
    );
  }

  try {
    const topPost = getTopPostByPeriod(period);
    if (!topPost) {
      return NextResponse.json(
        { message: `No posts found for the period: ${period}` },
        { status: 404 }
      );
    }
    return NextResponse.json(topPost);
  } catch (error) {
    console.error(`Error fetching top post for period ${period}:`, error);
    return NextResponse.json(
      { message: "Internal server error while fetching top post" },
      { status: 500 }
    );
  }
}
