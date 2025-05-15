import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = startDate.getDay(); // Sunday - 0, Monday - 1, ...
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
        startDate = new Date(startDate.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const { data: topPost, error } = await supabase
      .from('posts')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle to return null instead of error if no post found

    if (error) {
      console.error(`Error fetching top post for period ${period}:`, error);
      return NextResponse.json(
        { message: "Error fetching top post" },
        { status: 500 }
      );
    }

    if (!topPost) {
      return NextResponse.json(
        { message: `No posts found for the period: ${period}` },
        { status: 404 }
      );
    }
    return NextResponse.json(topPost);
  } catch (e: unknown) {
    console.error(`Unexpected error fetching top post for period ${period}:`, e);
    let errorMessage = 'Unknown error';
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return NextResponse.json(
      { message: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
