import { NextRequest, NextResponse } from "next/server";
import { findPostById, upvotePost, downvotePost } from "@/lib/dataStore";

interface VoteRequestBody {
  action: "upvote" | "downvote";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;

  if (!postId) {
    return NextResponse.json(
      { message: "Post ID is required" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = (await request.json()) as VoteRequestBody;
  } catch {
    return NextResponse.json(
      { message: "Invalid request body: Must be JSON" },
      { status: 400 }
    );
  }

  const { action } = body;

  if (!action || (action !== "upvote" && action !== "downvote")) {
    return NextResponse.json(
      { message: "Invalid action: Must be upvote or downvote" },
      { status: 400 }
    );
  }

  const postExists = findPostById(postId);
  if (!postExists) {
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }

  try {
    let updatedPost;
    if (action === "upvote") {
      updatedPost = await upvotePost(postId);
    } else {
      updatedPost = await downvotePost(postId);
    }

    if (!updatedPost) {
      return NextResponse.json(
        {
          message:
            "Failed to update post votes, post may no longer exist or save failed.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error(`Error updating votes for post ${postId}:`, error);
    return NextResponse.json(
      { message: "Internal server error while updating votes" },
      { status: 500 }
    );
  }
}
