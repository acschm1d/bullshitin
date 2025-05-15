import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface VoteRequestBody {
  action: "upvote" | "downvote";
}

type Props = {
  params: Promise<{
    postId: string;
  }>;
};

export async function POST(request: NextRequest, context: Props) {
  const { postId } = await context.params;

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

  // Check if post exists first
  const { data: existingPost, error: findError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (findError || !existingPost) {
    console.error(`Error finding post ${postId} or post not found:`, findError);
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }

  try {
    let updatedPostData;
    let rpcError;

    if (action === "upvote") {
      const { data, error } = await supabase.rpc('increment_upvotes', {
        post_id_to_update: postId,
      });
      updatedPostData = data;
      rpcError = error;
    } else { // action === "downvote"
      const { data, error } = await supabase.rpc('decrement_upvotes', {
        post_id_to_update: postId,
      });
      updatedPostData = data;
      rpcError = error;
    }

    if (rpcError) {
      console.error(`Supabase RPC error for post ${postId}, action ${action}:`, rpcError);
      return NextResponse.json(
        { message: `Failed to ${action} post: ${rpcError.message}` },
        { status: 500 }
      );
    }
    
    // The RPC functions return a TABLE, so result is an array of rows.
    // Expecting an array with one element for a successful update.
    if (!updatedPostData || (Array.isArray(updatedPostData) && updatedPostData.length === 0)) {
        console.error(`Supabase RPC for post ${postId}, action ${action} did not return updated post data.`);
        return NextResponse.json(
            { message: "Failed to update post votes, operation did not return data." },
            { status: 500 }
        );
    }

    const finalUpdatedPost = Array.isArray(updatedPostData) ? updatedPostData[0] : updatedPostData;

    return NextResponse.json(finalUpdatedPost);

  } catch (error: unknown) { // Catch any other unexpected errors
    console.error(`Unexpected error processing vote for post ${postId}:`, error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
