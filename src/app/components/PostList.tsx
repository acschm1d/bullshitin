"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import PostCard from "./PostCard";
import { Post } from "@/types";

const POSTS_PER_PAGE = 10;

interface PostListProps {
  onPostVoted?: () => void;
  listKey?: string | number;
  newlySubmittedPostId?: string | null;
  onScrolledToNewPost?: () => void;
}

export default function PostList({
  onPostVoted,
  listKey,
  newlySubmittedPostId,
  onScrolledToNewPost,
}: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading || initialLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setCurrentPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading, initialLoading, hasMore]
  );

  const fetchPosts = useCallback(
    async (pageToFetch: number, isInitial: boolean) => {
      if (isInitial) {
        setInitialLoading(true);
        setPosts([]);
        setError(null);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await fetch(
          `/api/posts?page=${pageToFetch}&limit=${POSTS_PER_PAGE}`
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: `Failed to fetch posts: ${response.statusText}`,
          }));
          throw new Error(
            errorData.message || `Failed to fetch posts: ${response.statusText}`
          );
        }
        const data = await response.json();

        setPosts((prevPosts) =>
          pageToFetch === 1 ? data.posts : [...prevPosts, ...data.posts]
        );
        setHasMore(
          data.posts.length > 0 &&
            pageToFetch * POSTS_PER_PAGE < data.totalPosts
        );
        setError(null);
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred while fetching posts.");
        }
        console.error(`Failed to fetch posts (page ${pageToFetch}):`, e);
      }
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  }, [listKey, fetchPosts]);

  useEffect(() => {
    if (newlySubmittedPostId && posts.length > 0) {
      const element = document.getElementById(`post-${newlySubmittedPostId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        if (onScrolledToNewPost) {
          onScrolledToNewPost();
        }
      }
    }
  }, [posts, newlySubmittedPostId, onScrolledToNewPost]);

  useEffect(() => {
    if (currentPage > 1) {
      fetchPosts(currentPage, false);
    }
  }, [currentPage, fetchPosts]);

  const handleVoteSuccess = (updatedPost: Post) => {
    setPosts(
      (prevPosts) =>
        prevPosts.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      // Consider re-fetching or more sophisticated sorting if order is critical after vote
      // For now, just update in place. The global sort will eventually show via parent refresh.
    );
    if (onPostVoted) {
      onPostVoted();
    }
  };

  return (
    <div>
      {initialLoading && (
        <div className="text-center py-10">
          <p className="text-xl text-slate-400">Loading Bullshit-o-Meter...</p>
          {/* TODO: Add a nice spinner component here */}
        </div>
      )}

      {error && (
        <div className="text-center py-10 p-4 mb-6 bg-rose-500/10 rounded-lg border border-rose-500/30 text-rose-300">
          <p className="text-xl font-semibold">Error loading posts</p>
          <p>{error}</p>
        </div>
      )}

      {!initialLoading && !isLoading && !error && posts.length === 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-slate-400">
            No bullshit found... yet. Be the first to submit!
          </p>
        </div>
      )}

      {(!initialLoading || posts.length > 0) && !error && (
        <div className="space-y-6">
          {posts.map((post, index) => {
            if (posts.length === index + 1) {
              return (
                <div
                  id={`post-${post.id}`}
                  ref={lastPostElementRef}
                  key={post.id}
                >
                  <PostCard post={post} onVoteSuccess={handleVoteSuccess} />
                </div>
              );
            }
            return (
              <div id={`post-${post.id}`} key={post.id}>
                <PostCard post={post} onVoteSuccess={handleVoteSuccess} />
              </div>
            );
          })}
        </div>
      )}
      {isLoading && !initialLoading && (
        <div className="text-center py-6">
          <p className="text-lg text-slate-400">Loading more bullshit...</p>
          {/* TODO: Add a smaller spinner here */}
        </div>
      )}
      {!isLoading && !initialLoading && !hasMore && posts.length > 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-slate-500">
            🎉 You&apos;ve reached the bottom of the bullshit barrel! 🎉
          </p>
        </div>
      )}
    </div>
  );
}
