"use client";

import { useState, useEffect } from "react";
import { Post } from "@/types";

interface PostCardProps {
  post: Post;
  onVoteSuccess: (updatedPost: Post) => void;
}

const SESSION_STORAGE_VOTE_KEY_PREFIX = "voted_bullshitin_";

export default function PostCard({ post }: PostCardProps) {
  const [currentVotes, setCurrentVotes] = useState(post.upvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [hasVotedInSession, setHasVotedInSession] = useState(false);

  useEffect(() => {
    // Check session storage when component mounts or post.id changes
    if (typeof window !== "undefined" && window.sessionStorage) {
      const alreadyVoted = sessionStorage.getItem(
        `${SESSION_STORAGE_VOTE_KEY_PREFIX}${post.id}`
      );
      if (alreadyVoted === "true") {
        setHasVotedInSession(true);
      }
    }
  }, [post.id]);

  const handleVote = async (action: "upvote" | "downvote") => {
    if (isVoting || hasVotedInSession) return;
    setIsVoting(true);
    setVoteError(null);

    try {
      const response = await fetch(`/api/posts/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const updatedPost = await response.json();

      if (!response.ok) {
        throw new Error(updatedPost.message || `Failed to ${action}`);
      }

      setCurrentVotes(updatedPost.upvotes);

      // Record vote in session storage
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(
          `${SESSION_STORAGE_VOTE_KEY_PREFIX}${post.id}`,
          "true"
        );
        setHasVotedInSession(true);
      }
    } catch (err) {
      if (err instanceof Error) {
        setVoteError(err.message);
      } else {
        setVoteError("An unknown error occurred during voting.");
      }
      console.error(`Error ${action} post ${post.id}:`, err);
    }
    setIsVoting(false);
  };

  return (
    <div className="bg-slate-800/70 p-6 rounded-xl shadow-2xl mb-6 border border-slate-700 hover:border-sky-500 transition-all duration-300 ease-in-out transform hover:scale-[1.01]">
      <h3 className="text-xl font-semibold mb-1 text-sky-400 hover:text-sky-300">
        <a href={post.url} target="_blank" rel="noopener noreferrer">
          {post.title || post.url} {/* Display title, fallback to URL */}
        </a>
      </h3>

      {/* Post URL - Display if title was shown, for clarity */}
      {post.title && (
        <p className="text-xs text-slate-500 mb-2 break-all">
          Source:{" "}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-400"
          >
            {post.url}
          </a>
        </p>
      )}

      <hr className="border-slate-700/60 my-4" />

      <div className="flex justify-between items-center mb-3 text-sm text-slate-400">
        <p>
          Language:{" "}
          <span className="uppercase font-semibold bg-slate-700 px-2 py-0.5 rounded text-sky-300 text-xs">
            {post.language}
          </span>
        </p>
        <p>Posted: {new Date(post.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-sky-300">
          {currentVotes} <span className="text-xl">BS Points</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleVote("upvote")}
            disabled={isVoting || hasVotedInSession}
            className={`p-2 rounded-full bg-green-500/20 text-green-300 transition-colors ${
              hasVotedInSession
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-green-500/40 disabled:opacity-50"
            }`}
          >
            Upvote BS 👍
          </button>
          <button
            onClick={() => handleVote("downvote")}
            disabled={isVoting || hasVotedInSession}
            className={`p-2 rounded-full bg-red-500/20 text-red-300 transition-colors ${
              hasVotedInSession
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-500/40 disabled:opacity-50"
            }`}
          >
            Downvote 👎
          </button>
        </div>
      </div>
      {voteError && (
        <p className="text-xs text-red-400 mt-2 text-center">
          Error: {voteError}
        </p>
      )}
      {hasVotedInSession && (
        <p className="text-xs text-sky-400 mt-2 text-center">
          You&apos;ve already voted on this post.
        </p>
      )}
    </div>
  );
}
